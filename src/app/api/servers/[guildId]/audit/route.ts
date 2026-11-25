import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCollections, toIso } from "@/lib/mongodb";
import { resolveServerAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.canViewStaffTools) {
    return NextResponse.json(
      { error: "Server Owner or Moderator access required to view audit logs." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 60)));

  const { auditLogs } = await getCollections();
  const filter: Record<string, unknown> = { guildId };
  if (q) {
    filter.$or = [
      { action: { $regex: q, $options: "i" } },
      { targetType: { $regex: q, $options: "i" } },
      { actorId: { $regex: q, $options: "i" } },
    ];
  }

  const docs = await auditLogs
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json(
    {
      logs: docs.map((a) => ({
        id: String(a._id),
        actorId: String(a.actorId || ""),
        action: String(a.action || ""),
        targetType: String(a.targetType || ""),
        targetId: String(a.targetId || ""),
        details: (a.details && typeof a.details === "object"
          ? a.details
          : {}) as Record<string, unknown>,
        createdAt: toIso(a.createdAt),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
