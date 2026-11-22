import { NextRequest, NextResponse } from "next/server";
import { getCollections, serializeDocs } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { auditLogs } = await getCollections();
  const guildId = req.nextUrl.searchParams.get("guildId");
  const targetId = req.nextUrl.searchParams.get("targetId");
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 40)));
  const query: Record<string, unknown> = {};
  if (guildId) query.guildId = guildId;
  if (targetId) query.targetId = targetId;
  const rows = await auditLogs.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  return NextResponse.json({ logs: serializeDocs(rows) });
}
