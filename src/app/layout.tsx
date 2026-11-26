import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./beta-ui.css";
import { AuthProvider } from "@/components/AuthContext";
import { WorkspaceProvider } from "@/components/WorkspaceContext";
import { AppShell } from "@/components/AppShell";
import { SITE_SETTINGS } from "@/lib/site-settings";
import { UI_MODE_BOOT_SCRIPT } from "@/lib/ui-mode";

export const metadata: Metadata = {
  title: `${SITE_SETTINGS.siteName} — ${SITE_SETTINGS.tagline}`,
  description: SITE_SETTINGS.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Applies the saved Original/Beta design before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: UI_MODE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[#07090e] text-slate-100 antialiased">
        <AuthProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
