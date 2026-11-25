import { redirect } from "next/navigation";
import { getCollections, toObjectId } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function LegacyManageTournamentRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (oid) {
    try {
      const { tournaments } = await getCollections();
      const doc = await tournaments.findOne(
        { _id: oid },
        { projection: { guildId: 1 } }
      );
      if (doc?.guildId) {
        redirect(`/servers/${encodeURIComponent(String(doc.guildId))}/tournaments/${encodeURIComponent(id)}/settings`);
      }
    } catch {
      // fall through to /servers
    }
  }
  redirect("/servers");
}
