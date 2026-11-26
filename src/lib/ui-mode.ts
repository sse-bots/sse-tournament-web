import { applyThemeToDocument, type ThemeState } from "@/lib/theme-config";

/**
 * UI mode switch.
 *
 *  - "classic": the original design (default for everyone).
 *  - "beta":    the new tournament design. Purely a front-end skin; it never
 *               touches API routes, services or stored data.
 *
 * The choice is remembered in this browser, so a visitor who picks Beta sees
 * Beta the next time they open the site.
 */
export type UiMode = "classic" | "beta";

export const UI_MODE_KEY = "sse-ui-mode-v1";
export const UI_MODE_EVENT = "sse-ui-mode-change";

const BETA_FONT_ID = "sse-gfont-beta-ui";
const BETA_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;600;700&display=swap";
const BETA_FONT_STACK =
  "'DM Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Theme variables the beta stylesheet provides its own defaults for. */
const BETA_PALETTE_VARS = [
  "--accent-400",
  "--accent-500",
  "--accent-600",
  "--accent-on-solid",
  "--accent-glow",
  "--accent-soft",
  "--accent-hero-tint",
  "--accent-border",
  "--surface-bg",
  "--surface-sidebar",
  "--surface-card",
  "--surface-input",
  "--surface-muted",
  "--surface-hover",
  "--surface-border",
];

/**
 * Runs in <head> before first paint so a Beta visitor never sees the classic
 * design flash. Kept as a plain string because it must execute before React.
 */
export const UI_MODE_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem("${UI_MODE_KEY}")==="beta"){var d=document.documentElement;d.setAttribute("data-ui","beta");if(!document.getElementById("${BETA_FONT_ID}")){var l=document.createElement("link");l.id="${BETA_FONT_ID}";l.rel="stylesheet";l.href="${BETA_FONT_HREF}";document.head.appendChild(l);}}}catch(e){}})();`;

export function loadUiMode(): UiMode {
  if (typeof window === "undefined") return "classic";
  try {
    return window.localStorage.getItem(UI_MODE_KEY) === "beta"
      ? "beta"
      : "classic";
  } catch {
    return "classic";
  }
}

export function saveUiMode(mode: UiMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

/** Save the choice and tell the app shell to re-apply it. */
export function setUiMode(mode: UiMode): void {
  saveUiMode(mode);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UI_MODE_EVENT));
  }
}

function ensureBetaFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(BETA_FONT_ID)) return;
  const link = document.createElement("link");
  link.id = BETA_FONT_ID;
  link.rel = "stylesheet";
  link.href = BETA_FONT_HREF;
  document.head.appendChild(link);
}

/**
 * Applies the saved theme first (exactly as the original app does), then layers
 * the UI mode on top.
 *
 * In Beta, if the person has not customised the palette, the beta stylesheet's
 * own palette is used. Any preset, accent, neutral or font they pick in the
 * theme customiser still wins.
 */
export function applyThemeAndUi(theme: ThemeState, mode: UiMode): void {
  applyThemeToDocument(theme);
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  if (mode !== "beta") {
    root.removeAttribute("data-ui");
    return;
  }

  root.setAttribute("data-ui", "beta");
  ensureBetaFonts();

  const untouchedPalette =
    theme.preset === "default" &&
    theme.primary === "green" &&
    theme.neutral === "slate";

  if (untouchedPalette) {
    for (const name of BETA_PALETTE_VARS) root.style.removeProperty(name);
  }
  if (theme.font === "public-sans") {
    root.style.setProperty("--app-font", BETA_FONT_STACK);
  }

  const bg = getComputedStyle(root).getPropertyValue("--surface-bg").trim();
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (meta && bg) meta.content = bg;
}
