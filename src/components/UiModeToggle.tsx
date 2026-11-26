"use client";

import { Sparkles } from "lucide-react";
import { setUiMode, type UiMode } from "@/lib/ui-mode";

/**
 * Switch between the original design and the Beta design.
 * Works in both modes, so people can always go back.
 */
export function UiModeToggle({ mode }: { mode: UiMode }) {
  const isBeta = mode === "beta";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isBeta}
      onClick={() => setUiMode(isBeta ? "classic" : "beta")}
      title={
        isBeta
          ? "Switch back to the original design"
          : "Try the new tournament design"
      }
      className="sse-ui-toggle flex w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-left text-xs font-bold text-slate-300 transition hover:border-indigo-500/60 hover:text-white"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
        <span className="truncate">New look</span>
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300">
          Beta
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          isBeta ? "bg-indigo-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            isBeta ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
