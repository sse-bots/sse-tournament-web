"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Hash, Plus, Search, Shield, X } from "lucide-react";
import type { GuildChannelInfo, GuildRoleInfo } from "@/lib/tournament-types";
import { CustomSelect, type CustomSelectOption } from "@/components/CustomSelect";

export function DiscordRoleMultiPicker({
  roles,
  selectedIds,
  onChange,
  label,
  hint,
  placeholder = "Search Discord roles...",
  disabled = false,
}: {
  roles: GuildRoleInfo[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [manualId, setManualId] = useState("");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleMap = useMemo(
    () => new Map(roles.map((r) => [r.id, r])),
    [roles]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.id.includes(q)
    );
  }, [roles, search]);

  // Close dropdown automatically when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleRole(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function addManual() {
    const cleaned = manualId.trim().replace(/[^0-9]/g, "");
    if (!cleaned || cleaned.length < 15) return;
    if (!selectedIds.includes(cleaned)) {
      onChange([...selectedIds, cleaned]);
    }
    setManualId("");
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-200">{label}</label>
          <span className="text-[10px] font-semibold text-slate-400">
            {selectedIds.length} selected
          </span>
        </div>
      )}
      {hint && <p className="text-[11px] leading-relaxed text-slate-400">{hint}</p>}

      {/* Selected Role Pills */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((rid) => {
            const info = roleMap.get(rid);
            return (
              <span
                key={rid}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: info?.color || "#94a3b8" }}
                />
                <span>{info ? `@${info.name}` : `Role ${rid.slice(-6)}`}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggleRole(rid)}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                    aria-label="Remove role"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Searchable Dropdown Trigger & Popover List */}
      {!disabled && (
        <div className="space-y-2">
          {roles.length > 0 ? (
            <div ref={dropdownRef} className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  value={search}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOpen(true);
                  }}
                  placeholder={placeholder}
                  className={`w-full rounded-xl border bg-slate-950 py-2.5 pl-8 pr-8 text-xs text-white placeholder:text-slate-500 focus:outline-none ${
                    open
                      ? "border-indigo-500 ring-2 ring-indigo-500/20"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                />
                {(open || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (search) {
                        setSearch("");
                      } else {
                        setOpen(false);
                      }
                    }}
                    className="absolute right-2.5 top-2 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title={search ? "Clear search" : "Close list"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {open && (
                <div className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-slate-700/90 bg-[#0b1120] p-1.5 shadow-2xl shadow-black/50">
                  {filtered.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-slate-500">
                      No matching Discord roles found.
                    </div>
                  ) : (
                    filtered.map((role) => {
                      const active = selectedIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleRole(role.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                            active
                              ? "bg-indigo-600/20 font-bold text-indigo-300"
                              : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: role.color }}
                            />
                            <span className="truncate">@{role.name}</span>
                          </span>
                          {active && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Shield className="h-3.5 w-3.5" />
                Discord roles not synced yet
              </div>
              <p className="mt-1">
                Ensure the SSE Tournament Bot is online in this server to load
                role names automatically, or enter a Discord Role ID manually
                below.
              </p>
            </div>
          )}

          {/* Manual Role ID Fallback */}
          <div className="flex gap-2">
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManual();
                }
              }}
              placeholder="Or paste numeric Discord Role ID..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addManual}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-indigo-500 hover:text-white"
            >
              <Plus className="h-3 w-3" /> Add ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DiscordSingleRolePicker({
  roles,
  value,
  onChange,
  label,
  hint,
  emptyLabel = "None selected",
  disabled = false,
}: {
  roles: GuildRoleInfo[];
  value: string;
  onChange: (nextId: string) => void;
  label?: string;
  hint?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const options = useMemo<CustomSelectOption[]>(() => {
    const hasMatch = !value || roles.some((r) => r.id === value);
    const list: CustomSelectOption[] = [
      { value: "", label: emptyLabel },
    ];
    if (!hasMatch && value) {
      list.push({
        value,
        label: `Custom Role (${value.slice(-6)})`,
        dotColor: "#94a3b8",
      });
    }
    for (const r of roles) {
      list.push({
        value: r.id,
        label: `@${r.name}`,
        dotColor: r.color || "#94a3b8",
      });
    }
    return list;
  }, [roles, value, emptyLabel]);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-slate-200">{label}</label>
      )}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      <CustomSelect
        disabled={disabled}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={emptyLabel}
        searchPlaceholder="Search Discord roles..."
        searchable={roles.length > 5}
        emptyMessage="No matching roles found."
      />
    </div>
  );
}

export function DiscordChannelPicker({
  channels,
  value,
  onChange,
  label,
  hint,
  emptyLabel = "Use bot default channel",
  disabled = false,
}: {
  channels: GuildChannelInfo[];
  value: string;
  onChange: (nextId: string) => void;
  label?: string;
  hint?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const options = useMemo<CustomSelectOption[]>(() => {
    const hasMatch = !value || channels.some((c) => c.id === value);
    const list: CustomSelectOption[] = [
      { value: "", label: emptyLabel },
    ];
    if (!hasMatch && value) {
      list.push({
        value,
        label: `Channel (${value.slice(-6)})`,
        icon: <Hash className="h-3.5 w-3.5" />,
      });
    }
    for (const ch of channels) {
      list.push({
        value: ch.id,
        label: ch.name,
        badge: ch.category || undefined,
        icon: <Hash className="h-3.5 w-3.5" />,
      });
    }
    return list;
  }, [channels, value, emptyLabel]);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Hash className="h-3.5 w-3.5 text-indigo-400" />
          {label}
        </label>
      )}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      <CustomSelect
        disabled={disabled}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={emptyLabel}
        searchPlaceholder="Search Discord channels..."
        searchable={channels.length > 5}
        emptyMessage="No matching channels found."
      />
    </div>
  );
}
