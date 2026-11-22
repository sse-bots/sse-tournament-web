import { ObjectId } from "mongodb";
import { getCollections } from "./mongo";

export type WebBotEventType =
  | "tournament.published"
  | "tournament.finished"
  | "match.sync_channels"
  | "match.result_submitted"
  | "match.result_reviewed"
  | "match.rescheduled"
  | "match.roster_updated"
  | "match.cleanup_channels"
  | "support.ticket_created"
  | "support.ticket_updated";

export interface EnqueueBotEventInput {
  guildId: string;
  type: WebBotEventType;
  actorId: string;
  tournamentId?: ObjectId | null;
  matchId?: ObjectId | null;
  ticketId?: ObjectId | null;
  payload?: Record<string, unknown>;
}

export async function enqueueBotEvent(input: EnqueueBotEventInput): Promise<void> {
  try {
    const { webBotEvents } = await getCollections();
    await webBotEvents.insertOne({
      guildId: String(input.guildId),
      type: input.type,
      actorId: String(input.actorId),
      tournamentId: input.tournamentId || null,
      matchId: input.matchId || null,
      ticketId: input.ticketId || null,
      payload: input.payload || {},
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      processedAt: null,
    });
  } catch (err) {
    console.error("[bot-sync] failed to enqueue event:", input.type, err);
  }
}
