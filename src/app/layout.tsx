import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { WorkspaceProvider } from "@/components/WorkspaceContext";
import { AppShell } from "@/components/AppShell";
import { SITE_SETTINGS } from "@/lib/site-settings";

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
