import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimKal (סימקל) — eSIM לחו״ל",
  description: "סימקל — eSIM לנסיעות לחו״ל: אירופה, ארה״ב, תאילנד ועוד. התקנה מיידית בסריקת QR.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
