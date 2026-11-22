import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/permissions";
import { inspectServers, getBotInviteUrl } from "@/lib/server-status";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: "Sign in with SSE Nexus required." }, { status: 401 });
  }

  const checkGuildId = req.nextUrl.searchParams.get("checkGuildId")?.trim() || null;
  if (checkGuildId && !/^\d{17,20}$/.test(checkGuildId)) {
    return NextResponse.json(
      { error: "Enter a valid numeric Discord Server ID (17–20 digits)." },
      { status: 400 }
    );
  }

  try {
    const servers = await inspectServers(checkGuildId);
    const nexusUrl = (process.env.NEXUS_BASE_URL || "https://sse-nexus.vercel.app").replace(/\/+$/, "");
    return NextResponse.json({
      servers,
      botInviteUrl: getBotInviteUrl(checkGuildId || undefined),
      nexusUrl,
      liveDiscordCheckEnabled: Boolean(process.env.DISCORD_BOT_TOKEN?.trim()),
    });
  } catch (err) {
    console.error("[api/servers GET]", err);
    return NextResponse.json({ error: "Failed to verify Discord servers." }, { status: 500 });
  }
}
