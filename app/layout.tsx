import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/mulish/latin-400.css";
import "@fontsource/mulish/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "HKUST events",
  description: "Find student events and prepare your registration.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="mx-auto max-w-5xl px-6 py-8 text-[13px] text-muted">
          Unofficial student project. Not affiliated with or endorsed by HKUST.
        </footer>
      </body>
    </html>
  );
}
