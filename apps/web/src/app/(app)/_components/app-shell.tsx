"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar, type AppSection } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeSection: AppSection = pathname.startsWith("/settings") ? "settings" : "event-chat";

  return (
    <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      <AppSidebar activeSection={activeSection} />

      <div className="h-[100dvh] min-w-0 flex-1 overflow-hidden">{children}</div>
    </SidebarProvider>
  );
}
