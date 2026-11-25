"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import {
  DiscordChannelPicker,
  DiscordRoleMultiPicker,
  DiscordSingleRolePicker,
} from "@/components/DiscordRolePicker";
import { ServerGuard } from "@/components/ServerGuard";
import { useWorkspace } from "@/components/WorkspaceContext";

export default function ServerSettingsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData, refreshServer } = useWorkspace();

  const [defaultModRoles, setDefaultModRoles] = useState<string[]>([]);
  const [supportStaffRole, setSupportStaffRole] = useState("");
  const [announcementChannel, setAnnouncementChannel] = useState("");
  const [logChannel, setLogChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = serverData?.settings;

  useEffect(() => {
    if (!settings) return;
    setDefaultModRoles(settings.defaultModeratorRoleIds || []);
    setSupportStaffRole(settings.supportStaffRoleId || "");
    setAnnouncementChannel(settings.announcementChannelId || "");
    setLogChannel(settings.logChannelId || "");
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(guildId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModeratorRoleIds: defaultModRoles,
          supportStaffRoleId: supportStaffRole || null,
          announcementChannelId: announcementChannel || null,
          logChannelId: logChannel || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save server settings.");
        return;
      }
      await refreshServer();
      setToast(
        "Server settings saved! SSE Tournament Bot will refresh role member permissions within ~15 seconds."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ServerGuard guildId={guildId} requireOwner>
      {settings && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                Server Settings
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Configure default Moderator roles, support staff, and Discord
                channels for{" "}
                <strong className="text-white">{settings.guildName}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshServer}
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500 sm:self-center"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Synced Roles
            </button>
          </div>

          {toast && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{toast}</span>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Staff & Moderator Roles */}
            <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  Default Moderator &amp; Staff Roles
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Members holding these Discord roles automatically see admin
                  tools (proof approval, match review, support tickets, result
                  declaration) when they sign in. Only you (Server Owner) can
                  create tournaments or edit these roles.
                </p>
              </div>

              <DiscordRoleMultiPicker
                roles={settings.discordRoles}
                selectedIds={defaultModRoles}
                onChange={setDefaultModRoles}
                label="Default Tournament Moderator Roles"
                hint="Inherited automatically by new tournaments. You can also customize moderators per tournament."
              />

              <div className="border-t border-slate-800/80 pt-4">
                <DiscordSingleRolePicker
                  roles={settings.discordRoles}
                  value={supportStaffRole}
                  onChange={setSupportStaffRole}
                  label="Support Desk Staff Role"
                  hint="Authorized to handle private /support tickets in Discord and on the website."
                  emptyLabel="Use server default / bot .env role"
                />
              </div>
            </section>

            {/* Discord Channels */}
            <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
                  <Server className="h-4 w-4 text-emerald-400" />
                  Discord Channels &amp; Bot WebSync
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Choose where SSE Tournament Bot posts web-triggered
                  announcements, final podium results, and audit logs.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DiscordChannelPicker
                  channels={settings.discordChannels}
                  value={announcementChannel}
                  onChange={setAnnouncementChannel}
                  label="Default Announcement Channel"
                  hint="Used for registration opens, matchmaking live alerts, and final winners."
                />
                <DiscordChannelPicker
                  channels={settings.discordChannels}
                  value={logChannel}
                  onChange={setLogChannel}
                  label="Bot Audit / Log Channel"
                  hint="Receives round-generation logs and WebSync activity alerts."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white">
                    Bot WebSync Status:{" "}
                    <span
                      className={
                        settings.botOnline
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {settings.botOnline ? "Online & Syncing" : "Waiting for Bot Heartbeat"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Synced <strong className="text-white">{settings.discordRoles.length}</strong>{" "}
                    roles &amp;{" "}
                    <strong className="text-white">{settings.discordChannels.length}</strong>{" "}
                    text channels
                    {settings.botLastSyncAt
                      ? ` · Last heartbeat ${new Date(settings.botLastSyncAt).toLocaleString("en-IN")}`
                      : ""}
                  </div>
                </div>
                <CopyButton value="/setup" label="Copy /setup" />
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving Settings..." : "Save Server Settings"}
              </button>
            </div>
          </form>
        </div>
      )}
    </ServerGuard>
  );
}
