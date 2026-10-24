import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "TroveSuite CRM", template: "%s · TroveSuite CRM" },
  description: "TroveSuite CRM redesign — interactive UX prototype with fictional data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${plex.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
