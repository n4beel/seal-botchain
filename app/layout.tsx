import type { Metadata, Viewport } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { app } from "@/lib/app-config";
import "./globals.css";

/**
 * A serif for text and a mono for hashes. A digest is a thing people compare character by
 * character, so the mono is chosen for disambiguated zeroes and ones rather than for looks.
 */
const body = Source_Serif_4({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const monoUi = JetBrains_Mono({ variable: "--font-mono-ui", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: { title: app.name, description: app.tagline, type: "website", url: app.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${monoUi.variable} h-full`}>
      <body className="min-h-full antialiased">
        <EvmProvider>
          <ToastProvider>{children}</ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
