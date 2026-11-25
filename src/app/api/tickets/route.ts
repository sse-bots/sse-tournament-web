import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toIso, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { canManageGuildOrTournament } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchTicketSchema = z.object({
  ticketId: z.string().min(1),
  action: z.enum(["claim", "awaiting_player", "resolve", "close", "escalate", "reopen"]),
  note: z.string().trim().max(300).optional().default(""),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const guildId = (searchParams.get("guildId") || "").trim();
  if (!guildId) return NextResponse.json({ error: "guildId required." }, { status: 400 });
  if (!(await canManageGuildOrTournament(session, guildId))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { tickets } = await getCollections();
  const docs = await tickets.find({ guildId }).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({
    tickets: docs.map((tk) => ({
      id: String(tk._id),
      guildId: String(tk.guildId || ""),
      tournamentId: tk.tournamentId ? String(tk.tournamentId) : null,
      userId: String(tk.userId || ""),
      category: String(tk.category || "general"),
      description: String(tk.description || ""),
      channelId: tk.channelId ? String(tk.channelId) : null,
      status: String(tk.status || "open"),
      claimedBy: tk.claimedBy ? String(tk.claimedBy) : null,
      assignedTo: tk.assignedTo ? String(tk.assignedTo) : null,
      resolution: typeof tk.resolution === "string" ? tk.resolution : null,
      createdAt: toIso(tk.createdAt),
    })),
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = patchTicketSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid ticket update." }, { status: 400 });

  const oid = toObjectId(parsed.data.ticketId);
  if (!oid) return NextResponse.json({ error: "Invalid ticket ID." }, { status: 400 });

  const { tickets } = await getCollections();
  const ticket = await tickets.findOne({ _id: oid });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (!(await canManageGuildOrTournament(session, String(ticket.guildId)))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const { action, note } = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: now };

  if (action === "claim") { updates.status = "claimed"; updates.claimedBy = actorId; updates.claimedAt = now; }
  else if (action === "awaiting_player") { updates.status = "awaiting_player"; }
  else if (action === "resolve") { updates.status = "resolved"; updates.resolution = note || "Resolved via web dashboard"; updates.resolvedAt = now; updates.resolvedBy = actorId; }
  else if (action === "close") { updates.status = "closed"; updates.resolution = note || ticket.resolution || "Closed via web dashboard"; updates.closedAt = now; updates.closedBy = actorId; }
  else if (action === "escalate") { updates.status = "escalated"; updates.escalatedBy = actorId; updates.escalatedAt = now; updates.escalationReason = note; }
  else if (action === "reopen") { updates.status = "open"; updates.reopenedBy = actorId; updates.reopenedAt = now; updates.reopenReason = note; }

  await tickets.updateOne({ _id: oid }, { $set: updates });
  await writeAuditLog({ guildId: String(ticket.guildId), actorId, action: `support.${action}`, targetType: "Ticket", targetId: String(oid), details: { note } });
  return NextResponse.json({ ok: true });
}
