import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "LifeInbox | Calendar assistant",
  description: "Turn everyday appointments, deadlines, and reminders into clear calendar drafts.",
  openGraph: {
    title: "LifeInbox",
    description: "Clear calendar drafts from everyday messages.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LifeInbox product preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LifeInbox",
    description: "Clear calendar drafts from everyday messages.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
