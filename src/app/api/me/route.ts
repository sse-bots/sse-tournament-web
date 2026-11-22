import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guildId = req.nextUrl.searchParams.get("guildId");
  const actor = await getSessionActor(guildId);
  return NextResponse.json({ actor });
}
