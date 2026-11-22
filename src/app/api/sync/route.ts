import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDocs } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const guildId = req.nextUrl.searchParams.get("guildId")?.trim() || "";
  const tournamentId = toObjectId(req.nextUrl.searchParams.get("tournamentId"));

  const { webBotEvents, matches } = await getCollections();
  const query: Record<string, unknown> = {};
  if (guildId) query.guildId = guildId;
  if (tournamentId) query.tournamentId = tournamentId;

  const [pending, failed, recent, missingChannels] = await Promise.all([
    webBotEvents.countDocuments({ ...query, status: { $in: ["pending", "processing"] } }),
    webBotEvents.countDocuments({ ...query, status: "failed" }),
    webBotEvents.find(query).sort({ createdAt: -1 }).limit(12).toArray(),
    tournamentId
      ? matches.countDocuments({
          tournamentId,
          isBye: { $ne: true },
          status: { $nin: ["cancelled"] },
          $or: [{ channelId: { $exists: false } }, { channelId: null }, { channelId: "" }],
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json({
    pending,
    failed,
    missingChannels,
    recent: serializeDocs(recent),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "sync_channels");
  const tournamentOid = toObjectId(body.tournamentId);

  const { tournaments, webBotEvents } = await getCollections();

  if (action === "retry_failed") {
    const guildId = String(body.guildId || "").trim();
    const filter: Record<string, unknown> = { status: "failed" };
    if (guildId) filter.guildId = guildId;
    if (tournamentOid) filter.tournamentId = tournamentOid;
    const res = await webBotEvents.updateMany(filter, {
      $set: { status: "pending", attempts: 0, lastError: null },
    });
    return NextResponse.json({ ok: true, retried: res.modifiedCount });
  }

  if (!tournamentOid) {
    return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
  }

  const t = await tournaments.findOne({ _id: tournamentOid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  await enqueueBotEvent({
    guildId: String(t.guildId),
    type: "match.sync_channels",
    actorId: actor.discordId,
    tournamentId: tournamentOid,
    payload: { manualTrigger: true },
  });

  return NextResponse.json({
    ok: true,
    message: "Queued channel sync for SSE Tournament Bot. Discord channels will appear shortly.",
  });
}
