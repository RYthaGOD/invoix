import React from "react";
import { Home, Plus, Users, FileText, Settings, Shield, Zap, LayoutTemplate } from "lucide-react";
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

const menuItems = [
  {
    title: "Overview",
    url: "/invoices", // Changed from /dashboard to /invoices to match actual route
    icon: Home,
  },
  {
    title: "Create Invoice",
    url: "/invoices/create",
    icon: Plus,
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
    url: "/dashboard/blacklist", // Keeping if relevant, or remove if not implemented
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
          <SidebarGroupLabel className="flex items-center gap-2 py-4">
            <img src="/invoix-logo.jpg" alt="Invoix Logo" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold">Invoix</span>
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
                    <Link href={item.url}>
                      <item.icon className="w-5 h-5" {...({} as any)} />
                      <span>{item.title}</span>
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
