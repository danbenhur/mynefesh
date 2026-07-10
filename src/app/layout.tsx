import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // BRAND pending Q2 (brand name + domain) — placeholder title only
  title: "eSIM לחו״ל — חנות בהקמה",
  description: "eSIM לנסיעות לחו״ל: אירופה, ארה״ב, תאילנד ועוד. התקנה מיידית בסריקת QR.",
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
