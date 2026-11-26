"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Trash2, X } from "lucide-react";

export type ConfirmModalVariant = "danger" | "warning" | "primary";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  inputLabel,
  inputPlaceholder,
  inputRequired = false,
  initialInputValue = "",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  busy?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
  initialInputValue?: string;
  onClose: () => void;
  onConfirm: (inputValue: string) => void | Promise<void>;
}) {
  const [inputValue, setInputValue] = useState(initialInputValue);

  useEffect(() => {
    if (open) {
      setInputValue(initialInputValue);
    }
  }, [open, initialInputValue]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const canConfirm = !busy && (!inputRequired || inputValue.trim().length > 0);

  const iconBoxClass =
    variant === "danger"
      ? "border-rose-500/35 bg-rose-500/15 text-rose-400"
      : variant === "warning"
        ? "border-amber-500/35 bg-amber-500/15 text-amber-400"
        : "border-indigo-500/35 bg-indigo-500/15 text-indigo-400";

  const confirmBtnClass =
    variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-500"
      : variant === "warning"
        ? "bg-amber-600 text-white hover:bg-amber-500"
        : "bg-indigo-600 text-white hover:bg-indigo-500";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-3xl border border-slate-700/90 bg-[#0b1120] p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${iconBoxClass}`}
            >
              {variant === "danger" ? (
                <Trash2 className="h-4 w-4" />
              ) : variant === "warning" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="Close popup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {inputLabel && (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-200">
              {inputLabel}
              {inputRequired && <span className="ml-1 text-rose-400">*</span>}
            </label>
            <textarea
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              disabled={busy}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(inputValue.trim())}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${confirmBtnClass}`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
