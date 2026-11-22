import { MongoClient, Db, ObjectId, Document } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _sseMongoClient?: MongoClient;
  _sseMongoPromise?: Promise<MongoClient>;
};

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Add it to .env.local or Vercel Environment Variables."
    );
  }
  return uri;
}

export function getMongoClient(): MongoClient {
  if (globalForMongo._sseMongoClient) {
    return globalForMongo._sseMongoClient;
  }
  const client = new MongoClient(getMongoUri(), {
    appName: "SSE-Tournament-Web",
    serverSelectionTimeoutMS: 12000,
    connectTimeoutMS: 10000,
  });
  globalForMongo._sseMongoClient = client;
  return client;
}

export async function getDb(): Promise<Db> {
  const client = getMongoClient();
  if (!globalForMongo._sseMongoPromise) {
    globalForMongo._sseMongoPromise = client.connect();
  }
  await globalForMongo._sseMongoPromise;
  const dbName = process.env.MONGODB_DB_NAME || undefined;
  return dbName ? client.db(dbName) : client.db();
}

export function getDbSync(): Db {
  const client = getMongoClient();
  const dbName = process.env.MONGODB_DB_NAME || undefined;
  return dbName ? client.db(dbName) : client.db();
}

export async function getCollections() {
  const db = await getDb();
  return {
    db,
    games: db.collection("games"),
    tournaments: db.collection("tournaments"),
    registrations: db.collection("registrations"),
    teams: db.collection("teams"),
    matches: db.collection("matches"),
    tickets: db.collection("support_tickets"),
    auditLogs: db.collection("audit_logs"),
    guildConfig: db.collection("guild_config"),
    seriesRecords: db.collection("series_records"),
    availability: db.collection("availability"),
  };
}

export function toObjectId(value: string | ObjectId | null | undefined): ObjectId | null {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value) && value.length === 24) {
    return new ObjectId(value);
  }
  return null;
}

export function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (val instanceof ObjectId) return val.toHexString();
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return val;
}

export function serializeDoc<T = Record<string, unknown>>(doc: Document | null): T | null {
  if (!doc) return null;
  return serializeValue(doc) as T;
}

export function serializeDocs<T = Record<string, unknown>>(docs: Document[]): T[] {
  return docs.map((d) => serializeValue(d) as T);
}

export async function writeAudit(
  guildId: string,
  actorId: string,
  action: string,
  targetType: string = "",
  targetId: string | ObjectId = "",
  details: Record<string, unknown> = {}
) {
  try {
    const { auditLogs } = await getCollections();
    await auditLogs.insertOne({
      guildId: String(guildId),
      actorId: String(actorId),
      action,
      targetType,
      targetId: targetId instanceof ObjectId ? targetId.toHexString() : String(targetId || ""),
      details,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[sse-audit] failed to write audit log:", err);
  }
}
