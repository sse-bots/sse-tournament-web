import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        arena: {
          bg: "var(--arena-bg)",
          surface: "var(--arena-surface)",
          elevated: "var(--arena-elevated)",
          border: "var(--arena-border)",
          text: "var(--arena-text)",
          muted: "var(--arena-muted)",
          gold: "var(--arena-gold)",
          cyan: "var(--arena-cyan)",
          crimson: "var(--arena-crimson)",
          emerald: "var(--arena-emerald)",
        },
      },
      boxShadow: {
        arena: "0 14px 36px -14px rgba(0, 0, 0, 0.35)",
        glowGold: "0 0 28px -6px rgba(245, 158, 11, 0.45)",
        glowCyan: "0 0 28px -6px rgba(6, 182, 212, 0.40)",
      },
    },
  },
  plugins: [],
};

export default config;
