import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dinner Air ✈ 聚餐報名",
  description: "航空 check-in 風格的聚餐報名系統：報名、選位、登機證、QR 報到",
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
