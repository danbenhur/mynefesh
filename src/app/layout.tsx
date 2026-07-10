import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimKal (סימקל) — eSIM לחו״ל",
  description: "סימקל — eSIM לנסיעות לחו״ל: אירופה, ארה״ב, תאילנד ועוד. התקנה מיידית בסריקת QR.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Agent storefront skin (SPEC §2): name + photo + accent color on top
  // of the shared store. Main site when no tenant.
  const tenant = await getCurrentTenant();

  return (
    <html lang="he" dir="rtl">
      <body
        style={
          tenant
            ? ({ "--accent": tenant.accentColor } as React.CSSProperties)
            : undefined
        }
      >
        <header className="brand-bar">
          <Link href="/" className="brand-lockup">
            {tenant ? (
              <>
                {tenant.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.photoUrl}
                    alt=""
                    className="brand-photo"
                  />
                ) : null}
                <span className="brand-name">{tenant.displayName}</span>
                <span className="brand-powered">⚡ powered by SimKal</span>
              </>
            ) : (
              <>
                <span className="brand-name">סימקל SimKal</span>
                <span className="brand-powered">eSIM לחו״ל</span>
              </>
            )}
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
