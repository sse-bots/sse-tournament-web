import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDocs, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";
import { TICKET_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus required." }, { status: 401 });

  const { tickets } = await getCollections();
  const guildId = req.nextUrl.searchParams.get("guildId");
  const status = req.nextUrl.searchParams.get("status");
  const query: Record<string, unknown> = {};
  if (guildId) query.guildId = guildId;
  if (status && status !== "all") query.status = status;
  const rows = await tickets.find(query).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({ tickets: serializeDocs(rows) });
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus required." }, { status: 401 });

  const body = await req.json();
  const category = String(body.category || "general");
  const description = String(body.description || "").trim();
  const guildId = String(body.guildId || actor.activeGuildId || "").trim();
  const tournamentId = toObjectId(body.tournamentId);

  if (!TICKET_CATEGORIES.includes(category as (typeof TICKET_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid ticket category." }, { status: 400 });
  }
  if (!description || !guildId) {
    return NextResponse.json({ error: "Description and Server ID are required." }, { status: 400 });
  }

  const { tickets } = await getCollections();
  const doc = {
    guildId,
    tournamentId,
    userId: actor.discordId,
    category,
    description,
    channelId: null,
    status: "open",
    createdAt: new Date(),
  };
  const res = await tickets.insertOne(doc);
  await writeAudit(guildId, actor.discordId, "support.create", "Ticket", res.insertedId, {
    category,
  });

  await enqueueBotEvent({
    guildId,
    type: "support.ticket_created",
    actorId: actor.discordId,
    tournamentId,
    ticketId: res.insertedId,
  });

  return NextResponse.json({ ticket: serializeDoc({ ...doc, _id: res.insertedId }) }, { status: 201 });
}
