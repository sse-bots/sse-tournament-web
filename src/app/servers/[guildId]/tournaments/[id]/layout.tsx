import { ServerGuard } from "@/components/ServerGuard";
import { TournamentDetailProvider } from "@/components/TournamentDetailContext";

export default async function TournamentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string; id: string }>;
}) {
  const { guildId, id } = await params;
  const decodedGuild = decodeURIComponent(guildId);
  const decodedId = decodeURIComponent(id);

  return (
    <ServerGuard guildId={decodedGuild}>
      <TournamentDetailProvider
        guildId={decodedGuild}
        tournamentId={decodedId}
      >
        {children}
      </TournamentDetailProvider>
    </ServerGuard>
  );
}
