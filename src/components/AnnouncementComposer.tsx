"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Bold,
  Code,
  Eye,
  EyeOff,
  Hash,
  Heading2,
  Italic,
  List,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { GuildChannelInfo, GuildRoleInfo } from "@/lib/tournament-types";

interface MentionCandidate {
  id: string;
  label: string;
  insertText: string;
  description?: string;
  dotColor?: string;
  kind: "everyone" | "here" | "role" | "channel";
}

function renderInlinePreview(
  line: string,
  roleMap: Map<string, GuildRoleInfo>,
  channelMap: Map<string, GuildChannelInfo>
) {
  const tokens: Array<{ type: string; text: string; color?: string }> = [];
  const regex =
    /(<@&(\d+)>|<#(\d+)>|@everyone|@here|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|`([^`]+)`|\|\|([^|]+)\|\|)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      const role = roleMap.get(match[2]);
      tokens.push({
        type: "mention",
        text: role ? `@${role.name}` : "@role",
        color: role?.color || "#818cf8",
      });
    } else if (match[3]) {
      const ch = channelMap.get(match[3]);
      tokens.push({
        type: "channel",
        text: ch ? `#${ch.name}` : "#channel",
      });
    } else if (match[0] === "@everyone" || match[0] === "@here") {
      tokens.push({
        type: "mention",
        text: match[0],
        color: "#f59e0b",
      });
    } else if (match[4]) {
      tokens.push({ type: "bold", text: match[4] });
    } else if (match[5]) {
      tokens.push({ type: "underline", text: match[5] });
    } else if (match[6]) {
      tokens.push({ type: "strike", text: match[6] });
    } else if (match[7]) {
      tokens.push({ type: "italic", text: match[7] });
    } else if (match[8]) {
      tokens.push({ type: "code", text: match[8] });
    } else if (match[9]) {
      tokens.push({ type: "spoiler", text: match[9] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    tokens.push({ type: "text", text: line.slice(lastIndex) });
  }

  return tokens.map((tok, idx) => {
    if (tok.type === "bold") {
      return (
        <strong key={idx} className="font-extrabold text-white">
          {tok.text}
        </strong>
      );
    }
    if (tok.type === "italic") {
      return (
        <em key={idx} className="italic">
          {tok.text}
        </em>
      );
    }
    if (tok.type === "underline") {
      return (
        <span key={idx} className="underline underline-offset-2">
          {tok.text}
        </span>
      );
    }
    if (tok.type === "strike") {
      return (
        <span key={idx} className="line-through opacity-75">
          {tok.text}
        </span>
      );
    }
    if (tok.type === "code") {
      return (
        <code
          key={idx}
          className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300"
        >
          {tok.text}
        </code>
      );
    }
    if (tok.type === "spoiler") {
      return (
        <span
          key={idx}
          className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400"
          title="Spoiler"
        >
          {tok.text}
        </span>
      );
    }
    if (tok.type === "mention") {
      return (
        <span
          key={idx}
          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold"
          style={{
            backgroundColor: `${tok.color || "#6366f1"}24`,
            color: tok.color || "#a5b4fc",
          }}
        >
          {tok.text}
        </span>
      );
    }
    if (tok.type === "channel") {
      return (
        <span
          key={idx}
          className="inline-flex items-center rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[11px] font-bold text-indigo-300"
        >
          {tok.text}
        </span>
      );
    }
    return <span key={idx}>{tok.text}</span>;
  });
}

export function AnnouncementComposer({
  value,
  onChange,
  roles,
  channels = [],
  tournamentName,
  weekNumber,
  placeholder = "Write your announcement... Type @ to mention Discord roles or # for channels",
  rows = 4,
  required = false,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  roles: GuildRoleInfo[];
  channels?: GuildChannelInfo[];
  tournamentName?: string;
  weekNumber?: number | null;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState<{
    char: "@" | "#";
    startIndex: number;
    endIndex: number;
    query: string;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const roleMap = useMemo(
    () => new Map(roles.map((r) => [r.id, r])),
    [roles]
  );
  const channelMap = useMemo(
    () => new Map(channels.map((c) => [c.id, c])),
    [channels]
  );

  const candidates = useMemo<MentionCandidate[]>(() => {
    if (!mentionTrigger) return [];
    const q = mentionTrigger.query.trim().toLowerCase();

    if (mentionTrigger.char === "@") {
      const base: MentionCandidate[] = [
        {
          id: "everyone",
          label: "@everyone",
          insertText: "@everyone ",
          description: "Notify all members in this server",
          dotColor: "#f59e0b",
          kind: "everyone",
        },
        {
          id: "here",
          label: "@here",
          insertText: "@here ",
          description: "Notify online members",
          dotColor: "#38bdf8",
          kind: "here",
        },
        ...roles.map((r) => ({
          id: r.id,
          label: `@${r.name}`,
          insertText: `<@&${r.id}> `,
          description: "Discord Role",
          dotColor: r.color || "#94a3b8",
          kind: "role" as const,
        })),
      ];
      if (!q) return base.slice(0, 35);
      return base
        .filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
        )
        .slice(0, 35);
    }

    const chItems: MentionCandidate[] = channels.map((ch) => ({
      id: ch.id,
      label: `#${ch.name}`,
      insertText: `<#${ch.id}> `,
      description: ch.category || "Text Channel",
      kind: "channel",
    }));
    if (!q) return chItems.slice(0, 35);
    return chItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      )
      .slice(0, 35);
  }, [mentionTrigger, roles, channels]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionTrigger?.query, mentionTrigger?.char]);

  // Close mention popup when clicking/tapping outside
  useEffect(() => {
    if (!mentionTrigger) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMentionTrigger(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [mentionTrigger]);

  function detectTrigger(text: string, cursorPos: number) {
    const before = text.slice(0, cursorPos);
    const match = before.match(/(?:^|\s)([@#])([^\s@#<>]*)$/);
    if (!match) {
      setMentionTrigger(null);
      return;
    }
    const triggerChar = match[1] as "@" | "#";
    const query = match[2] || "";
    const startIndex = cursorPos - query.length - 1;
    if (triggerChar === "#" && channels.length === 0) {
      setMentionTrigger(null);
      return;
    }
    setMentionTrigger({
      char: triggerChar,
      startIndex,
      endIndex: cursorPos,
      query,
    });
  }

  function handleTextChange(nextValue: string, cursorPos: number) {
    onChange(nextValue);
    detectTrigger(nextValue, cursorPos);
  }

  function insertMention(item: MentionCandidate) {
    if (!mentionTrigger) return;
    const before = value.slice(0, mentionTrigger.startIndex);
    const after = value.slice(mentionTrigger.endIndex);
    const next = `${before}${item.insertText}${after}`;
    const nextCursor = before.length + item.insertText.length;
    onChange(next);
    setMentionTrigger(null);
    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  }

  function applyWrap(prefix: string, suffix: string, sample: string) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const inner = selected || sample;
    const next = `${value.slice(0, start)}${prefix}${inner}${suffix}${value.slice(end)}`;
    const selStart = start + prefix.length;
    const selEnd = selStart + inner.length;
    onChange(next);
    setMentionTrigger(null);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function applyLinePrefix(prefix: string, sample: string) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const needsNewline = start > 0 && value[start - 1] !== "
";
    const lead = needsNewline ? "
" : "";

    if (selected) {
      const formatted = selected
        .split("
")
        .map((ln) => `${prefix}${ln}`)
        .join("
");
      const next = `${value.slice(0, start)}${lead}${formatted}${value.slice(end)}`;
      const nextPos = start + lead.length + formatted.length;
      onChange(next);
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      });
    } else {
      const insertion = `${lead}${prefix}${sample}`;
      const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      const selStart = start + lead.length + prefix.length;
      const selEnd = selStart + sample.length;
      onChange(next);
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selStart, selEnd);
      });
    }
  }

  function triggerMentionMenu(char: "@" | "#") {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const needsSpace = start > 0 && !/\s/.test(value[start - 1]);
    const insertStr = `${needsSpace ? " " : ""}${char}`;
    const next = `${value.slice(0, start)}${insertStr}${value.slice(end)}`;
    const nextPos = start + insertStr.length;
    onChange(next);
    setMentionTrigger({
      char,
      startIndex: nextPos - 1,
      endIndex: nextPos,
      query: "",
    });
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionTrigger && candidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + candidates.length) % candidates.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(candidates[activeIndex] || candidates[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionTrigger(null);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "b") {
        e.preventDefault();
        applyWrap("**", "**", "bold text");
      } else if (k === "i") {
        e.preventDefault();
        applyWrap("*", "*", "italic text");
      } else if (k === "u") {
        e.preventDefault();
        applyWrap("__", "__", "underlined text");
      }
    }
  }

  const previewLines = useMemo(() => value.split("
"), [value]);

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {[
            {
              title: "Bold (Ctrl+B)",
              icon: Bold,
              onClick: () => applyWrap("**", "**", "bold text"),
            },
            {
              title: "Italic (Ctrl+I)",
              icon: Italic,
              onClick: () => applyWrap("*", "*", "italic text"),
            },
            {
              title: "Underline (Ctrl+U)",
              icon: Underline,
              onClick: () => applyWrap("__", "__", "underlined text"),
            },
            {
              title: "Strikethrough",
              icon: Strikethrough,
              onClick: () => applyWrap("~~", "~~", "strikethrough"),
            },
            {
              title: "Inline Code",
              icon: Code,
              onClick: () => applyWrap("`", "`", "code"),
            },
            {
              title: "Heading",
              icon: Heading2,
              onClick: () => applyLinePrefix("## ", "Section Heading"),
            },
            {
              title: "Blockquote",
              icon: Quote,
              onClick: () => applyLinePrefix("> ", "Highlighted note"),
            },
            {
              title: "Bullet List",
              icon: List,
              onClick: () => applyLinePrefix("• ", "List item"),
            },
          ].map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.title}
                type="button"
                disabled={disabled}
                title={tool.title}
                onClick={tool.onClick}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-45"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}

          <div className="mx-1 h-4 w-px bg-slate-800" />

          <button
            type="button"
            disabled={disabled}
            onClick={() => triggerMentionMenu("@")}
            title="Mention a Discord role (@everyone, @here, or server roles)"
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/35 bg-indigo-500/15 px-2 py-1 text-[11px] font-bold text-indigo-300 transition hover:bg-indigo-500/25 disabled:opacity-45"
          >
            <AtSign className="h-3 w-3" />
            Role
          </button>

          {channels.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => triggerMentionMenu("#")}
              title="Mention a Discord channel"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300 transition hover:border-indigo-500/50 hover:text-white disabled:opacity-45"
            >
              <Hash className="h-3 w-3" />
              Channel
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
            showPreview
              ? "bg-indigo-600 text-white"
              : "border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          }`}
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3 w-3" /> Hide Preview
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Preview
            </>
          )}
        </button>
      </div>

      {/* Textarea + Floating @Role / #Channel Autocomplete */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={rows}
          required={required}
          disabled={disabled}
          minLength={2}
          maxLength={1800}
          value={value}
          onChange={(e) =>
            handleTextChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length
            )
          }
          onClick={(e) =>
            detectTrigger(value, e.currentTarget.selectionStart ?? value.length)
          }
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
              detectTrigger(
                value,
                e.currentTarget.selectionStart ?? value.length
              );
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3.5 text-xs leading-relaxed text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
        />

        {mentionTrigger && (
          <div className="absolute bottom-full left-0 right-0 z-[80] mb-1.5 overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0b1120] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <span>
                {mentionTrigger.char === "@"
                  ? `Discord Roles (${candidates.length})`
                  : `Discord Channels (${candidates.length})`}
              </span>
              <span className="font-normal normal-case text-slate-500">
                Tap or press Enter to insert
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto p-1.5">
              {candidates.length === 0 ? (
                <div className="px-3 py-3 text-center text-[11px] text-slate-500">
                  No matching{" "}
                  {mentionTrigger.char === "@" ? "roles" : "channels"} found.
                </div>
              ) : (
                candidates.map((item, idx) => {
                  const isHighlighted = idx === activeIndex;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(item);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                        isHighlighted
                          ? "bg-indigo-600/20 font-bold text-indigo-300"
                          : "text-slate-200 hover:bg-slate-800/80"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {item.kind === "channel" ? (
                          <Hash className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                        ) : (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: item.dotColor || "#94a3b8",
                            }}
                          />
                        )}
                        <span className="truncate font-semibold">
                          {item.label}
                        </span>
                      </span>
                      {item.description && (
                        <span className="shrink-0 truncate text-[10px] text-slate-400">
                          {item.description}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hint & Character Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
        <span>
          Type <code className="font-mono text-indigo-300">@</code> to pick
          Discord roles{channels.length > 0 ? " or # for channels" : ""}. Sent
          as clean plain Discord Markdown.
        </span>
        <span className="font-mono">{value.length}/1800</span>
      </div>

      {/* Live Discord Plain-Markdown Preview */}
      {showPreview && (
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/85 p-4 text-xs">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Live Discord Preview
          </div>
          <div className="space-y-1.5 text-slate-200">
            <div className="text-base font-black text-white">
              📣 {tournamentName || "Tournament Announcement"}
            </div>
            <div className="text-[11px] text-slate-400">
              {weekNumber
                ? `Week ${weekNumber} · Official Announcement`
                : "Official Announcement"}
            </div>
            <div className="text-[11px] text-slate-600">
              ──────────────────────────
            </div>
            <div className="space-y-1 py-1 leading-relaxed">
              {value.trim() ? (
                previewLines.map((ln, idx) => {
                  if (!ln.trim()) return <div key={idx} className="h-2" />;
                  if (ln.startsWith("### ")) {
                    return (
                      <div key={idx} className="text-xs font-extrabold text-white">
                        {renderInlinePreview(ln.slice(4), roleMap, channelMap)}
                      </div>
                    );
                  }
                  if (ln.startsWith("## ")) {
                    return (
                      <div key={idx} className="text-sm font-extrabold text-white">
                        {renderInlinePreview(ln.slice(3), roleMap, channelMap)}
                      </div>
                    );
                  }
                  if (ln.startsWith("# ")) {
                    return (
                      <div key={idx} className="text-base font-black text-white">
                        {renderInlinePreview(ln.slice(2), roleMap, channelMap)}
                      </div>
                    );
                  }
                  if (ln.startsWith("> ")) {
                    return (
                      <div
                        key={idx}
                        className="border-l-2 border-indigo-500/70 pl-2.5 text-slate-300"
                      >
                        {renderInlinePreview(ln.slice(2), roleMap, channelMap)}
                      </div>
                    );
                  }
                  return (
                    <div key={idx}>
                      {renderInlinePreview(ln, roleMap, channelMap)}
                    </div>
                  );
                })
              ) : (
                <span className="italic text-slate-500">
                  Start typing to preview your announcement...
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-600">
              ──────────────────────────
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
