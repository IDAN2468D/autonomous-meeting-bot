import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AuraMeet AI — סוכן פגישות אוטונומי",
  description:
    "פלטפורמת פגישות וידאו חיה עם אווטאר Simli, בינה מלאכותית Gemini, שיתוף מסך, תבניות סיכום ולוח שנה מובנה.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body
        className={`${heebo.className} text-slate-100 antialiased min-h-screen selection:bg-cyan-400/30 selection:text-cyan-100`}
      >
        {children}
      </body>
    </html>
  );
}
