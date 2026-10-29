import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/outfit";
import "./globals.css";
import { AppProvider } from "@/components/layout/AppProvider";
import { DEFAULT_PALETTE } from "@/lib/palettes";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Sudoku", template: "%s · Sudoku" },
  description: "Clear your mind. One number at a time. A calm, focused Sudoku for every level.",
  applicationName: "Sudoku",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sudoku", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f140d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light" data-palette={DEFAULT_PALETTE}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
