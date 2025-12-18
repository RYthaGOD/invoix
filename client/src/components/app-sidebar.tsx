import React from "react";
import { Home, Plus, Users, FileText, Settings, Shield, Zap, LayoutTemplate, Sparkles } from "lucide-react";
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
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-3 py-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
              <img src="/invoix-logo.jpg" alt="Invoix Logo" className="relative w-8 h-8 object-contain rounded-lg border border-white/10" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold font-heading tracking-tight leading-none">
                <span className="text-foreground">Inv</span>
                <span className="text-primary">oix</span>
              </span>
              <OGBadge />
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link href={item.url} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </div>
                      {(item as any).badge && (
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ml-auto ${(item as any).badgeColor || 'text-primary bg-primary/10 border-primary/20'}`}>
                          {(item as any).badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
