import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });

  const { tickets } = await getCollections();
  const ticket = await tickets.findOne({ _id: oid });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const body = await req.json();
  const action = String(body.action || "");
  const note = String(body.note || body.resolution || body.reason || "").trim();
  const now = new Date();
  const isOwner = String(ticket.userId) === actor.discordId;

  if (action !== "close" && isOwner && !actor.isBotAdmin) {
    return NextResponse.json(
      { error: "Support staff permission required for this action." },
      { status: 403 }
    );
  }

  const map: Record<string, Record<string, unknown>> = {
    claim: { status: "claimed", claimedBy: actor.discordId, claimedAt: now },
    awaiting_player: { status: "awaiting_player", updatedAt: now },
    resolve: { status: "resolved", resolution: note, resolvedAt: now, resolvedBy: actor.discordId },
    close: { status: "closed", resolution: note || "Closed", closedAt: now, closedBy: actor.discordId },
    reopen: { status: "open", reopenedAt: now, reopenedBy: actor.discordId, reopenReason: note },
    escalate: { status: "escalated", escalatedAt: now, escalatedBy: actor.discordId, escalationReason: note },
  };
  const changes = map[action];
  if (!changes) return NextResponse.json({ error: "Unknown ticket action." }, { status: 400 });

  await tickets.updateOne({ _id: oid }, { $set: changes });
  await writeAudit(String(ticket.guildId), actor.discordId, `support.${action}`, "Ticket", oid, {
    note,
  });

  await enqueueBotEvent({
    guildId: String(ticket.guildId),
    type: "support.ticket_updated",
    actorId: actor.discordId,
    ticketId: oid,
    payload: { action, note },
  });

  return NextResponse.json({ ticket: serializeDoc(await tickets.findOne({ _id: oid })) });
}
