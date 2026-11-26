"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  dotColor?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  searchable,
  disabled = false,
  className = "",
  buttonClassName = "",
  emptyMessage = "No matching options found.",
  ariaLabel,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  emptyMessage?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 7;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close when clicking or tapping outside, or pressing Escape
  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
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

  // Focus search input when opening searchable dropdown
  useEffect(() => {
    if (open && showSearch) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  }, [open, showSearch]);

  function toggleOpen() {
    if (disabled) return;
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpwards(spaceBelow < 260 && spaceAbove > spaceBelow);
    }
    setOpen((prev) => {
      if (prev) setQuery("");
      return !prev;
    });
  }

  function handleSelect(opt: CustomSelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-slate-950 px-3 py-2.5 text-left text-xs transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? "border-indigo-500 ring-2 ring-indigo-500/20"
            : "border-slate-800 hover:border-slate-700"
        } ${buttonClassName}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption?.dotColor && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-indigo-400">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate ${
              selectedOption ? "font-semibold text-white" : "text-slate-400"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="hidden shrink-0 rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-[75] overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0b1120] shadow-2xl shadow-black/50 ${
            openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {showSearch && (
            <div className="border-b border-slate-800/90 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-8 pr-7 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-2 rounded-md p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-slate-500">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? "bg-indigo-600/20 font-bold text-indigo-300"
                        : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {opt.dotColor && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: opt.dotColor }}
                        />
                      )}
                      {opt.icon && (
                        <span
                          className={`shrink-0 ${
                            isSelected ? "text-indigo-400" : "text-slate-400"
                          }`}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="block truncate text-[10px] font-normal text-slate-400">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {opt.badge && (
                        <span className="max-w-[110px] truncate rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-indigo-400" />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
