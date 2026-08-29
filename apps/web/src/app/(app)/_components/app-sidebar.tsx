"use client";

import {
  CalendarDays,
  ChevronsUpDown,
  Monitor,
  Moon,
  Palette,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export type AppSection = "event-chat" | "settings";

interface AppSidebarProps {
  activeSection: AppSection;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const NAVIGATION_ITEMS: Array<{
  section: AppSection;
  href: string;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { section: "event-chat", href: "/event-chat", label: "Event Chat", icon: CalendarDays },
  { section: "settings", href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppSidebar({ activeSection }: AppSidebarProps) {
  const { theme, setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();

  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/80 p-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Personal assistant">
              <Link href="/event-chat" onClick={closeMobileSidebar}>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                  <Sparkles className="size-4" strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span className="truncate font-semibold">Personal Assistant</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      asChild
                      isActive={activeSection === item.section}
                      aria-current={activeSection === item.section ? "page" : undefined}
                      tooltip={item.label}
                    >
                      <Link href={item.href} onClick={closeMobileSidebar}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="User menu"
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                      U
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">Local user</span>
                    <span className="truncate text-xs text-sidebar-foreground/65">
                      user@example.com
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={6}
                className="min-w-56"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={closeMobileSidebar}>
                    <Settings2 aria-hidden="true" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette aria-hidden="true" />
                    Appearance
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="min-w-40">
                      <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                        {THEME_OPTIONS.map((option) => {
                          const Icon = option.icon;

                          return (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                              <Icon aria-hidden="true" />
                              {option.label}
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
