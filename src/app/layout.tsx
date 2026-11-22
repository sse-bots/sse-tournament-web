import type { Metadata } from "next";
import { Chakra_Petch, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ArenaProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Navbar } from "@/components/navbar";

const displayFont = Chakra_Petch({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const sansFont = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SSE Arena — Competitive Tournament Command",
  description: "Esports tournament management portal synced with SSE Tournament Bot & SSE Nexus OAuth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body className="font-sans min-h-screen flex flex-col antialiased">
        <ArenaProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex-1 arena-grid-bg">{children}</main>
            <footer className="border-t border-[var(--arena-border)] bg-[var(--arena-surface)] py-5 text-center text-xs text-[var(--arena-muted)]">
              <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-display-caps font-bold tracking-wider text-[var(--arena-text)]">SSE TOURNAMENT ARENA</span>
                <span>Synced live with SSE Tournament Discord Bot • Better Auth × SSE Nexus OAuth</span>
              </div>
            </footer>
          </ToastProvider>
        </ArenaProvider>
      </body>
    </html>
  );
}
