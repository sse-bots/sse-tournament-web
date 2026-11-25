import { MongoClient, MongoClientOptions, Db, Document, ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const uri = (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sse_tournament_bot").trim();
const dbName = (process.env.MONGODB_DB_NAME || "").trim();

declare global {
  // eslint-disable-next-line no-var
  var _sseTournamentMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _sseTournamentMongoPromise: Promise<MongoClient> | undefined;
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  appName: "SSE-Tournament-Web",
};

function createClient(): MongoClient {
  const client = new MongoClient(uri, options);
  attachDatabasePool(client);
  return client;
}

export const mongoClient: MongoClient =
  globalThis._sseTournamentMongoClient ??
  (globalThis._sseTournamentMongoClient = createClient());

export async function getMongoClient(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    throw new Error("MONGODB_URI is not configured in environment variables.");
  }
  if (!globalThis._sseTournamentMongoPromise) {
    globalThis._sseTournamentMongoPromise = mongoClient
      .connect()
      .catch((err) => {
        globalThis._sseTournamentMongoPromise = undefined;
        throw err;
      });
  }
  return globalThis._sseTournamentMongoPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  if (dbName) return client.db(dbName);
  const inferred = client.db();
  if (!inferred.databaseName || inferred.databaseName === "test") {
    return client.db("sse_tournament_bot");
  }
  return inferred;
}

export async function getCollections() {
  const db = await getDb();
  return {
    db,
    games: db.collection<Document>("games"),
    tournaments: db.collection<Document>("tournaments"),
    registrations: db.collection<Document>("registrations"),
    teams: db.collection<Document>("teams"),
    matches: db.collection<Document>("matches"),
    tickets: db.collection<Document>("support_tickets"),
    auditLogs: db.collection<Document>("audit_logs"),
    guildConfig: db.collection<Document>("guild_config"),
    seriesRecords: db.collection<Document>("series_records"),
    availability: db.collection<Document>("availability"),
  };
}

export function toObjectId(value: string): ObjectId | null {
  if (!value || !ObjectId.isValid(value)) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string | Date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function writeAuditLog(params: {
  guildId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const { auditLogs } = await getCollections();
    await auditLogs.insertOne({
      guildId: String(params.guildId),
      actorId: String(params.actorId),
      action: params.action,
      targetType: params.targetType || "",
      targetId: String(params.targetId || ""),
      details: { ...(params.details || {}), source: "web_dashboard" },
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
