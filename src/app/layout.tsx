import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DINNER AIR ✈ 聚餐報名",
  description: "航空 check-in 風格的聚餐報名系統：報名、選位、登機證、QR 報到",
};

export const viewport: Viewport = {
  themeColor: "#05080f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="scanlines bg-night font-board min-h-screen text-glow antialiased">
        {children}
      </body>
    </html>
  );
}
