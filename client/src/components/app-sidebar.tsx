import React from "react";
import { Home, Plus, Users, FileText, Settings, Shield, Zap, LayoutTemplate, Sparkles, Code, CalendarClock } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

function OGBadge() {
  const { data } = useQuery<{ isOG: boolean }>({
    queryKey: ["/api/business/profile"],
  });

  if (!data?.isOG) return null;

  return (
    <div
      className="flex items-center gap-1 mt-1 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20 w-fit animate-pulse"
      title="OG Community Member"
    >
      <span>👑</span>
      <span>OG MEMBER</span>
    </div>
  );
}

const menuItems = [
  {
    title: "Overview",
    url: "/invoices",
    icon: Home,
  },
  {
    title: "Create Invoice",
    url: "/invoices/create",
    icon: Plus,
    id: "tour-create-invoice",
  },
  {
    title: "Community Drop",
    url: "/community-nft",
    icon: Sparkles,
    badge: "New",
    badgeColor: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: LayoutTemplate,
  },
  {
    title: "Subscriptions",
    url: "/subscriptions",
    icon: CalendarClock,
    badge: "New",
    badgeColor: "text-green-400 bg-green-400/10 border-green-400/20",
  },
  {
    title: "Stats",
    url: "/stats",
    icon: Zap,
  },
  {
    title: "Blacklist",
    url: "/dashboard/blacklist",
    icon: Shield,
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
  },
  {
    title: "Developer API",
    url: "/developers",
    icon: Code,
    badge: "Beta",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r-0 pt-9">
      {/* Clean Background */}
      <div className="absolute inset-0 bg-background -z-10 border-r border-border/30" />

      <SidebarContent className="px-3 py-4 flex flex-col h-full group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:items-center">
        {/* Logo Header - Compact */}
        <SidebarGroup>
          <SidebarGroupLabel className="mb-3 group-data-[collapsible=icon]:mb-4">
            <Link href="/" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="w-11 h-11 flex items-center justify-center gradient-primary rounded-lg group-hover:scale-105 transition-transform shrink-0">
                <span className="font-bold text-white text-xl">I</span>
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-lg font-bold font-heading tracking-tight leading-none">
                  <span className="text-foreground">Inv</span>
                  <span className="text-primary">oix</span>
                </span>
                <OGBadge />
              </div>
            </Link>
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Navigation Menu - Centered */}
        <div className="flex-1 flex flex-col justify-center">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 group-data-[collapsible=icon]:space-y-2">
                {menuItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        data-testid={`sidebar-${item.title.toLowerCase().replace(' ', '-')}`}
                        className={`
                          transition-all duration-200 rounded-lg
                          group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12
                          group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center
                          ${isActive
                            ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                          }
                        `}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5 w-full group-data-[collapsible=icon]:justify-center" id={(item as any).id}>
                          <item.icon className={`w-6 h-6 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                          <span className="text-sm font-medium truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                          {(item as any).badge && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ml-auto group-data-[collapsible=icon]:hidden ${(item as any).badgeColor || 'text-primary bg-primary/10 border-primary/20'}`}>
                              {(item as any).badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Footer Section - Compact */}
        <div className="pt-4 px-3 border-t border-border group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-2">
          <div className="text-xs text-muted-foreground space-y-0.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px]">All systems operational</span>
            </div>
            <div className="text-[10px] opacity-70">v1.0.0-beta</div>
          </div>
          <div className="hidden group-data-[collapsible=icon]:flex justify-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" title="All systems operational" />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
