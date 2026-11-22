import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament, canReviewTournamentResult } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";
import {
  applyResultScore,
  reverseSingleMatchScore,
  advanceSeriesIfNeeded,
  advanceTournamentIfReady,
} from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await params;
  const tid = toObjectId(id);
  const mid = toObjectId(matchId);
  if (!tid || !mid) return NextResponse.json({ error: "Invalid IDs." }, { status: 400 });

  const { tournaments, matches } = await getCollections();
  const [t, m] = await Promise.all([
    tournaments.findOne({ _id: tid }),
    matches.findOne({ _id: mid, tournamentId: tid }),
  ]);
  if (!t || !m) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus first." }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "");
  const note = String(body.note || body.reason || "").trim();
  const now = new Date();
  const participantIds = [...(m.sideAUserIds || []), ...(m.sideBUserIds || [])].map(String);
  const isParticipant = participantIds.includes(actor.discordId);

  if (action === "submit") {
    if (!isParticipant) {
      return NextResponse.json(
        { error: "Only assigned match participants can submit results." },
        { status: 403 }
      );
    }
    if (["paused", "completed", "cancelled", "archived"].includes(String(t.status))) {
      return NextResponse.json(
        { error: "Tournament is paused or closed; submissions are disabled." },
        { status: 409 }
      );
    }
    if (
      !["scheduled", "ready", "rejected", "disputed", "in_progress", "pending_proof"].includes(
        String(m.status)
      )
    ) {
      return NextResponse.json(
        { error: `Cannot submit result while match status is ${m.status}.` },
        { status: 409 }
      );
    }
    const winnerSide = String(body.winnerSide || "") as "A" | "B" | "DRAW";
    if (!["A", "B", "DRAW"].includes(winnerSide)) {
      return NextResponse.json({ error: "Choose Side A, Side B, or Draw." }, { status: 400 });
    }
    if (winnerSide === "DRAW") {
      if (
        t.format === "series" ||
        ["single_elimination", "double_elimination", "swiss"].includes(String(t.format))
      ) {
        return NextResponse.json(
          { error: `Draws are not allowed in ${t.format} tournaments.` },
          { status: 400 }
        );
      }
      if (!t.resultPolicy?.allowDraws) {
        return NextResponse.json({ error: "Draws are disabled for this tournament." }, { status: 400 });
      }
    }

    const proofUrl = String(body.proofUrl || "").trim();
    if ((t.resultPolicy?.proofRequired ?? true) && !proofUrl) {
      return NextResponse.json(
        { error: "Screenshot proof is required by tournament policy." },
        { status: 400 }
      );
    }

    const winnerIds =
      winnerSide === "A" ? m.sideAUserIds || [] : winnerSide === "B" ? m.sideBUserIds || [] : [];
    const winnerTeam =
      winnerSide === "A" ? m.sideATeamId : winnerSide === "B" ? m.sideBTeamId : null;
    const nextStatus = (t.resultPolicy?.approvalRequired ?? true) ? "pending_review" : "approved";

    const changes: Record<string, unknown> = {
      status: nextStatus,
      submittedBy: actor.discordId,
      proofUrl: proofUrl || null,
      reportedWinnerSide: winnerSide,
      reportedWinnerUserId: winnerIds[0] || null,
      reportedWinnerTeamId: winnerTeam || null,
      submittedAt: now,
    };
    if (nextStatus === "approved") {
      changes.reviewedBy = "auto";
      changes.reviewedAt = now;
      changes.reviewNote = "Auto-approved by tournament result policy.";
    }
    await matches.updateOne({ _id: mid }, { $set: changes });

    if (nextStatus === "approved") {
      const updatedM = { ...m, ...changes };
      await applyResultScore(t, updatedM, winnerSide);
      await advanceSeriesIfNeeded(t, updatedM);
      await advanceTournamentIfReady(t, Number(m.roundNumber || 1));
    }

    await writeAudit(String(t.guildId), actor.discordId, "match.submit", "Match", mid, {
      winnerSide,
      status: nextStatus,
      proof: proofUrl.slice(0, 120),
    });

    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.result_submitted",
      actorId: actor.discordId,
      tournamentId: tid,
      matchId: mid,
      payload: {
        winnerSide,
        status: nextStatus,
        proofUrl: proofUrl.startsWith("http") ? proofUrl : null,
      },
    });

    if (nextStatus === "approved") {
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.sync_channels",
        actorId: actor.discordId,
        tournamentId: tid,
      });
    }

    return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
  }

  if (action === "appeal") {
    if (!isParticipant) {
      return NextResponse.json({ error: "Only match participants can appeal." }, { status: 403 });
    }
    if (!["approved", "rejected", "disputed"].includes(String(m.status))) {
      return NextResponse.json(
        { error: "Only approved or rejected matches can be appealed." },
        { status: 409 }
      );
    }
    if (["completed", "cancelled", "archived"].includes(String(t.status))) {
      return NextResponse.json(
        { error: "Closed tournaments require an administrator override." },
        { status: 409 }
      );
    }
    if (!note) return NextResponse.json({ error: "Provide an appeal reason." }, { status: 400 });
    if (m.status === "approved") {
      if (m.seriesId) {
        return NextResponse.json(
          { error: "Series results must be escalated to head managers." },
          { status: 409 }
        );
      }
      await reverseSingleMatchScore(t, m);
    }
    await matches.updateOne(
      { _id: mid },
      {
        $set: {
          status: "disputed",
          appealBy: actor.discordId,
          appealAt: now,
          appealReason: note,
          appealScoreReversed: m.status === "approved",
        },
      }
    );
    await writeAudit(String(t.guildId), actor.discordId, "match.appeal", "Match", mid, {
      reason: note,
    });
    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.result_reviewed",
      actorId: actor.discordId,
      tournamentId: tid,
      matchId: mid,
      payload: { action: "appeal", note },
    });
    return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
  }

  if (["approve", "reject", "dispute", "request_proof", "resolve_dispute"].includes(action)) {
    const rev = await canReviewTournamentResult(actor, t);
    if (!rev.allowed || isParticipant) {
      return NextResponse.json(
        { error: "A non-participating manager or result reviewer is required." },
        { status: 403 }
      );
    }
    if (["paused", "completed", "cancelled", "archived"].includes(String(t.status))) {
      return NextResponse.json(
        { error: "Tournament is paused or closed; result review is disabled." },
        { status: 409 }
      );
    }

    if (action === "resolve_dispute") {
      if (m.status !== "disputed") {
        return NextResponse.json({ error: "Match is not disputed." }, { status: 409 });
      }
      if (!note) {
        return NextResponse.json({ error: "Resolution reason is required." }, { status: 400 });
      }
      const decision = String(body.decision || "");
      if (decision === "reject") {
        await matches.updateOne(
          { _id: mid },
          {
            $set: {
              status: "rejected",
              reviewedBy: actor.discordId,
              reviewedAt: now,
              reviewNote: note,
              disputeResolvedAt: now,
            },
          }
        );
      } else if (decision === "A" || decision === "B") {
        const wIds = decision === "A" ? m.sideAUserIds || [] : m.sideBUserIds || [];
        const changes = {
          status: "approved",
          reportedWinnerSide: decision,
          reportedWinnerUserId: wIds[0] || null,
          approvedWinnerUserId: wIds[0] || null,
          approvedWinnerTeamId: decision === "A" ? m.sideATeamId : m.sideBTeamId,
          reviewedBy: actor.discordId,
          reviewedAt: now,
          reviewNote: note,
          disputeResolvedAt: now,
        };
        await matches.updateOne({ _id: mid }, { $set: changes });
        const updatedM = { ...m, ...changes };
        await applyResultScore(t, updatedM, decision);
        await advanceSeriesIfNeeded(t, updatedM);
        await advanceTournamentIfReady(t, Number(m.roundNumber || 1));
      } else {
        return NextResponse.json({ error: "Decision must be A, B, or reject." }, { status: 400 });
      }
      await writeAudit(String(t.guildId), actor.discordId, "match.resolve_dispute", "Match", mid, {
        decision,
        reason: note,
      });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.result_reviewed",
        actorId: actor.discordId,
        tournamentId: tid,
        matchId: mid,
        payload: { action: "resolve_dispute", decision, note },
      });
      if (decision === "A" || decision === "B") {
        await enqueueBotEvent({
          guildId: String(t.guildId),
          type: "match.sync_channels",
          actorId: actor.discordId,
          tournamentId: tid,
        });
      }
      return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
    }

    if (m.status !== "pending_review") {
      return NextResponse.json({ error: "Match has no pending submission to review." }, { status: 409 });
    }

    if (action === "request_proof") {
      if (!note) {
        return NextResponse.json({ error: "Explain why new proof is needed." }, { status: 400 });
      }
      await matches.updateOne(
        { _id: mid },
        {
          $set: {
            status: "rejected",
            reviewedBy: actor.discordId,
            reviewedAt: now,
            reviewNote: note,
            proofRequested: true,
          },
        }
      );
      await writeAudit(String(t.guildId), actor.discordId, "match.request_proof", "Match", mid, {
        reason: note,
      });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.result_reviewed",
        actorId: actor.discordId,
        tournamentId: tid,
        matchId: mid,
        payload: { action: "request_proof", note },
      });
      return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
    }

    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "disputed";
    const changes: Record<string, unknown> = {
      status: nextStatus,
      reviewNote: note,
      reviewedBy: actor.discordId,
      reviewedAt: now,
    };
    if (action === "approve") {
      if (m.reportedWinnerTeamId) changes.approvedWinnerTeamId = m.reportedWinnerTeamId;
      else changes.approvedWinnerUserId = m.reportedWinnerUserId;
    }
    await matches.updateOne({ _id: mid }, { $set: changes });

    if (action === "approve") {
      const reportedSide = String(m.reportedWinnerSide || "");
      if (reportedSide === "A" || reportedSide === "B" || reportedSide === "DRAW") {
        const updatedM = { ...m, ...changes };
        await applyResultScore(t, updatedM, reportedSide);
        await advanceSeriesIfNeeded(t, updatedM);
        await advanceTournamentIfReady(t, Number(m.roundNumber || 1));
      }
    }
    await writeAudit(String(t.guildId), actor.discordId, `match.${action}`, "Match", mid, { note });
    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.result_reviewed",
      actorId: actor.discordId,
      tournamentId: tid,
      matchId: mid,
      payload: { action, note },
    });
    if (action === "approve") {
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.sync_channels",
        actorId: actor.discordId,
        tournamentId: tid,
      });
    }
    return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
  }

  if (["forfeit", "cancel", "reopen"].includes(action)) {
    const mgmt = await canManageTournament(actor, t);
    if (!mgmt.allowed) return NextResponse.json({ error: mgmt.reason }, { status: 403 });
    if (!note) return NextResponse.json({ error: "A mandatory reason is required." }, { status: 400 });

    if (action === "forfeit") {
      if (["approved", "forfeited", "cancelled"].includes(String(m.status))) {
        return NextResponse.json({ error: "Match is already finalized." }, { status: 409 });
      }
      const winnerSide = String(body.winnerSide || "") as "A" | "B";
      if (winnerSide !== "A" && winnerSide !== "B") {
        return NextResponse.json({ error: "Choose winnerSide A or B." }, { status: 400 });
      }
      const wIds = winnerSide === "A" ? m.sideAUserIds || [] : m.sideBUserIds || [];
      const changes = {
        status: "forfeited",
        reportedWinnerSide: winnerSide,
        reportedWinnerUserId: wIds[0] || null,
        reportedWinnerTeamId: winnerSide === "A" ? m.sideATeamId : m.sideBTeamId,
        reviewedBy: actor.discordId,
        reviewedAt: now,
        forfeitReason: note,
      };
      await matches.updateOne({ _id: mid }, { $set: changes });
      const updatedM = { ...m, ...changes };
      await applyResultScore(t, updatedM, winnerSide);
      await advanceSeriesIfNeeded(t, updatedM);
      await advanceTournamentIfReady(t, Number(m.roundNumber || 1));
      await writeAudit(String(t.guildId), actor.discordId, "match.forfeit", "Match", mid, {
        winnerSide,
        reason: note,
      });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.result_reviewed",
        actorId: actor.discordId,
        tournamentId: tid,
        matchId: mid,
        payload: { action: "forfeit", winnerSide, note },
      });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.sync_channels",
        actorId: actor.discordId,
        tournamentId: tid,
      });
      return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
    }

    if (action === "cancel") {
      if (m.status === "approved") {
        return NextResponse.json(
          { error: "Approved match cannot be cancelled; use admin override." },
          { status: 409 }
        );
      }
      await matches.updateOne(
        { _id: mid },
        { $set: { status: "cancelled", cancelledAt: now, cancelledBy: actor.discordId, cancelReason: note } }
      );
      await writeAudit(String(t.guildId), actor.discordId, "match.cancel", "Match", mid, { reason: note });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.result_reviewed",
        actorId: actor.discordId,
        tournamentId: tid,
        matchId: mid,
        payload: { action: "cancel", note },
      });
      return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
    }

    if (action === "reopen") {
      if (!["rejected", "disputed", "cancelled", "approved"].includes(String(m.status))) {
        return NextResponse.json({ error: "Cannot reopen match from current status." }, { status: 409 });
      }
      if (m.status === "approved" && !actor.isBotAdmin) {
        return NextResponse.json(
          { error: "Only a Bot Administrator can reopen an approved result." },
          { status: 403 }
        );
      }
      if (m.status === "approved") {
        if (m.seriesId) {
          return NextResponse.json(
            { error: "Finalized series matches cannot be reopened independently." },
            { status: 409 }
          );
        }
        await reverseSingleMatchScore(t, m);
      }
      await matches.updateOne(
        { _id: mid },
        {
          $set: { status: "scheduled", reopenedAt: now, reopenedBy: actor.discordId, reopenReason: note },
          $unset: {
            proofUrl: "",
            reportedWinnerSide: "",
            reportedWinnerUserId: "",
            reportedWinnerTeamId: "",
            reviewedAt: "",
            reviewedBy: "",
            approvedWinnerUserId: "",
            approvedWinnerTeamId: "",
          },
        }
      );
      await writeAudit(String(t.guildId), actor.discordId, "match.reopen", "Match", mid, { reason: note });
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.result_reviewed",
        actorId: actor.discordId,
        tournamentId: tid,
        matchId: mid,
        payload: { action: "reopen", note },
      });
      return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
    }
  }

  if (action === "override") {
    if (!actor.isBotAdmin) {
      return NextResponse.json(
        { error: "Bot Administrator permission required for result override." },
        { status: 403 }
      );
    }
    if (m.seriesId) {
      return NextResponse.json({ error: "Override is disabled for series matches." }, { status: 409 });
    }
    const winnerSide = String(body.winnerSide || "") as "A" | "B";
    if ((winnerSide !== "A" && winnerSide !== "B") || !note) {
      return NextResponse.json(
        { error: "winnerSide (A/B) and mandatory reason required." },
        { status: 400 }
      );
    }
    if (m.status === "approved" || m.status === "forfeited") {
      await reverseSingleMatchScore(t, m);
    }
    const wIds = winnerSide === "A" ? m.sideAUserIds || [] : m.sideBUserIds || [];
    const changes = {
      status: "approved",
      reportedWinnerSide: winnerSide,
      approvedWinnerUserId: wIds[0] || null,
      approvedWinnerTeamId: winnerSide === "A" ? m.sideATeamId : m.sideBTeamId,
      overrideBy: actor.discordId,
      overrideAt: now,
      overrideReason: note,
      reviewedBy: actor.discordId,
      reviewedAt: now,
    };
    await matches.updateOne({ _id: mid }, { $set: changes });
    await applyResultScore(t, { ...m, ...changes }, winnerSide);
    await writeAudit(String(t.guildId), actor.discordId, "match.override", "Match", mid, {
      from: m.reportedWinnerSide,
      to: winnerSide,
      reason: note,
    });
    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.result_reviewed",
      actorId: actor.discordId,
      tournamentId: tid,
      matchId: mid,
      payload: { action: "override", winnerSide, note },
    });
    return NextResponse.json({ ok: true, match: serializeDoc(await matches.findOne({ _id: mid })) });
  }

  return NextResponse.json({ error: "Unknown match action." }, { status: 400 });
}
