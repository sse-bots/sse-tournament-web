"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  Gamepad2,
  HelpCircle,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import {
  BOT_COMMANDS,
  DOC_CATEGORIES,
  FAQ_ITEMS,
  FORMAT_GUIDES,
  GAME_PLAYBOOKS,
  QUICKSTART_STEPS,
  SCORING_GUIDES,
  type DocCommandCategory,
} from "@/lib/bot-docs-data";
import { SITE_SETTINGS } from "@/lib/site-settings";

const PERM_COLORS: Record<string, string> = {
  Everyone: "bg-emerald-500/15 text-emerald-300",
  Participant: "bg-sky-500/15 text-sky-300",
  "Team Captain": "bg-cyan-500/15 text-cyan-300",
  "Manager / Reviewer": "bg-purple-500/15 text-purple-300",
  "Tournament Manager": "bg-indigo-500/15 text-indigo-300",
  "Support Staff": "bg-pink-500/15 text-pink-300",
  "Manage Server": "bg-amber-500/15 text-amber-300",
  "Server Owner / Admin": "bg-rose-500/15 text-rose-300",
};

export default function BotDocsPage() {
  const [section, setSection] = useState<"quickstart" | "commands" | "formats" | "playbooks" | "faq">("quickstart");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | DocCommandCategory>("all");
  const [expandedCmd, setExpandedCmd] = useState<string | null>("/tournament create");

  const filteredCommands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BOT_COMMANDS.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      return (
        c.command.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.permission.toLowerCase().includes(q) ||
        c.params.some((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      );
    });
  }, [search, category]);

  return (
    <div className="space-y-6">
      <section className="sse-arena-hero rounded-3xl border border-slate-800 p-6 shadow-2xl sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-[11px] font-bold text-indigo-300">
          <BookOpen className="h-3.5 w-3.5" /> Official SSE Tournament Bot Documentation
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">How to Setup &amp; Run SSE Tournament Bot</h1>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-300 sm:text-sm">
          Complete reference for every slash command, Squad-Power bracket rule, tournament format, Best-of series workflow, fair-play safeguard, and game playbook built into <code className="font-mono text-indigo-300">bot.py</code>.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={SITE_SETTINGS.links.nexusUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <Sparkles className="h-3.5 w-3.5" /> Get Activation Key in SSE Nexus
          </a>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:border-indigo-500">
            <Trophy className="h-3.5 w-3.5 text-amber-400" /> Open Web Control Dashboard
          </Link>
        </div>
      </section>

      <nav className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5">
        {([
          { id: "quickstart", label: "Quick Start Guide", icon: Sparkles },
          { id: "commands", label: `Command Reference (${BOT_COMMANDS.length} Groups)`, icon: Terminal },
          { id: "formats", label: "Formats & Scoring", icon: Layers },
          { id: "playbooks", label: "Game Playbooks", icon: Gamepad2 },
          { id: "faq", label: "Fair Play & FAQ", icon: HelpCircle },
        ] as const).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${section === item.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </nav>

      {section === "quickstart" && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber-500/35 bg-amber-500/10 p-5 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-extrabold text-amber-300"><ShieldCheck className="h-4 w-4" /> Required Discord Bot Permissions &amp; Intents</div>
            <p className="mt-1.5 leading-relaxed">
              Before running <code className="font-mono">/setup</code> or <code className="font-mono">/matchmaking</code>, ensure the bot has <strong>Manage Channels</strong>, <strong>Manage Roles</strong> (positioned above your podium award roles), <strong>Send Messages</strong>, <strong>Attach Files</strong>, and <strong>Read Message History</strong>. If self-hosting, enable <strong>Server Members Intent</strong> in the Discord Developer Portal.
            </p>
          </div>
          <div className="space-y-3">
            {QUICKSTART_STEPS.map((s) => (
              <div key={s.step} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">{s.step}</span>
                    <h2 className="text-base font-extrabold text-white">{s.title}</h2>
                  </div>
                  <CopyButton value={s.command} label="Copy Command" />
                </div>
                <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs text-indigo-300">{s.command}</pre>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">{s.detail}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setSection("commands")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500">
              <Terminal className="h-4 w-4" /> Explore Full Command Reference →
            </button>
          </div>
        </div>
      )}

      {section === "commands" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search command, parameter, or keyword..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as "all" | DocCommandCategory)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
              <option value="all">All Categories ({BOT_COMMANDS.length})</option>
              {DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCategory("all")} className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold ${category === "all" ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>All</button>
            {DOC_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold ${category === c.id ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>{c.label}</button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredCommands.map((cmd) => {
              const isOpen = expandedCmd === cmd.command;
              return (
                <div key={cmd.command} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65">
                  <button type="button" onClick={() => setExpandedCmd(isOpen ? null : cmd.command)} className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-800/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-sm font-extrabold text-indigo-300">{cmd.command}</code>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PERM_COLORS[cmd.permission] || "bg-slate-800 text-slate-300"}`}>{cmd.permission}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{cmd.summary}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-slate-800 bg-slate-950/60 p-4">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Usage Example</span>
                          <CopyButton value={cmd.example} label="Copy" />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-emerald-300">{cmd.example}</pre>
                      </div>
                      {cmd.params.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                              <tr><th className="px-3 py-2">Option</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                              {cmd.params.map((p) => (
                                <tr key={p.name}>
                                  <td className="px-3 py-2 font-mono text-indigo-300">
                                    {p.name}{p.required && <span className="ml-1 text-rose-400">*</span>}
                                    {p.autocomplete && <span className="ml-1.5 rounded bg-indigo-500/20 px-1 py-0.5 text-[9px] font-bold text-indigo-300">dropdown</span>}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{p.type}</td>
                                  <td className="px-3 py-2 text-slate-300">{p.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {cmd.notes && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                          <strong className="text-amber-300">Note: </strong>{cmd.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section === "formats" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FORMAT_GUIDES.map((f) => (
              <div key={f.id} className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">{f.badge}</span>
                    <span className="font-mono text-[10px] text-slate-400">{f.draws}</span>
                  </div>
                  <h3 className="mt-3 text-base font-extrabold text-white">{f.name}</h3>
                  <code className="font-mono text-[11px] text-amber-300">format:{f.id}</code>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{f.description}</p>
                </div>
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
                  <strong className="text-slate-200">Best for: </strong>{f.bestFor}
                </div>
              </div>
            ))}
          </div>

          <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-base font-extrabold text-white">Scoring Models &amp; Team Power Rules</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {SCORING_GUIDES.map((sc) => (
                <div key={sc.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">{sc.name}</span>
                    <code className="font-mono text-[10px] text-indigo-300">scoring:{sc.key}</code>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-400">{sc.formula}</div>
                  <p className="mt-1.5 text-xs text-slate-400">{sc.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {section === "playbooks" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {GAME_PLAYBOOKS.map((pb) => (
            <div key={pb.game} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border" style={{ backgroundColor: `${pb.accent}20`, borderColor: `${pb.accent}55`, color: pb.accent }}>
                  <Gamepad2 className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-extrabold text-white">{pb.game}</h2>
              </div>
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] font-semibold text-indigo-300">{pb.recommended}</div>
              <ol className="mt-4 space-y-2.5 text-xs text-slate-300">
                {pb.steps.map((st, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-bold text-white">{idx + 1}</span>
                    <span className="leading-relaxed">{st}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {section === "faq" && (
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-sm font-extrabold text-white">{item.q}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
