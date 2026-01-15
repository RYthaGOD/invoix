import React, { Fragment } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useLocation, Link } from "wouter";
import {
  ShieldCheck,
  ShieldAlert,
  Zap,
  Lock,
  Activity,
  ChevronDown,
  Server,
} from "lucide-react";
import { TourGuide } from "@/components/tour-guide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AnimatePresence, motion } from "framer-motion";

import { useQuery } from "@tanstack/react-query";

import type { ReactNode, CSSProperties } from "react";

interface SystemStatus {
  success: boolean;
  services: {
    [key: string]: {
      status: string;
      label: string;
      version?: string;
      skipFee?: boolean;
    };
  };
  network: {
    status: string;
    rpc: string;
  };
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  // Fetch system status
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/system/status"],
  });

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  // Generate breadcrumbs from path
  const pathSegments = location.split("/").filter((segment) => segment);

  return (
    <SidebarProvider style={style as CSSProperties}>
      {/* Devnet Warning Banner - Compact */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-400 text-amber-900 py-1.5 px-4 text-center text-xs md:text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5 md:gap-2">
          <span className="text-sm md:text-base">⚠️</span>
          <span className="hidden sm:inline">
            DEVNET ONLY — This is a testnet deployment. Do not use real funds.
          </span>
          <span className="sm:hidden">DEVNET ONLY</span>
          <span className="text-sm md:text-base">⚠️</span>
        </span>
      </div>

      <div
        className="flex h-screen w-full bg-background transition-colors duration-300 pt-9"
        id="tour-welcome"
      >
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header - Glass Effect (Homepage Style) - Compact & Responsive */}
          <header className="flex items-center justify-between px-4 md:px-6 py-2.5 md:py-3 border-b border-border/50 sticky top-0 z-50 bg-white/80 backdrop-blur-xl shadow-sm">
            <div className="flex items-center gap-3 md:gap-6">
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="hover:bg-muted rounded-md p-1.5 md:p-2 transition-colors"
              />

              {/* Dynamic Breadcrumbs */}
              <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href="/invoices"
                        className="hover:text-primary transition-colors font-medium"
                      >
                        Dashboard
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {pathSegments.length > 0 && <BreadcrumbSeparator />}
                  {pathSegments.map((segment, index) => {
                    const path = `/${pathSegments
                      .slice(0, index + 1)
                      .join("/")}`;
                    const isLast = index === pathSegments.length - 1;
                    const title =
                      segment.charAt(0).toUpperCase() +
                      segment.slice(1).replace(/-/g, " ");

                    return (
                      <Fragment key={path}>
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage className="font-semibold text-primary">
                              {title}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link
                                href={path}
                                className="hover:text-primary transition-colors"
                              >
                                {title}
                              </Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* System Status Dropdown - Responsive */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="tour-system-status"
                    className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs md:text-sm font-medium hover:bg-emerald-100 transition-all group"
                  >
                    <Activity className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden md:inline">System Secure</span>
                    <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 card-flat border mt-2"
                >
                  <DropdownMenuLabel className="flex items-center gap-2 text-foreground pb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold">Security Status</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />

                  <div className="p-2 space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-cyan-50 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-cyan-600" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {systemStatus?.services?.arcium?.label ||
                            "Arcium MXE"}
                        </span>
                      </div>
                      <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 text-xs font-semibold">
                        {systemStatus?.services?.arcium?.status || "ACTIVE"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {systemStatus?.services?.x402?.label ||
                            "x402 Anti-Spam"}
                        </span>
                      </div>
                      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold">
                        {systemStatus?.services?.x402?.skipFee
                          ? "DEBUG"
                          : systemStatus?.services?.x402?.status || "ACTIVE"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {systemStatus?.services?.replay?.label ||
                            "Anti-Replay Guard"}
                        </span>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                        {systemStatus?.services?.replay?.status || "SECURE"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                          <Server className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {systemStatus?.services?.atomic?.label ||
                            "Atomic Sequential"}
                        </span>
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                        {systemStatus?.services?.atomic?.status || "ENFORCED"}
                      </Badge>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border" />
                  <div className="p-3 bg-muted/30 rounded-b-lg">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Network: {systemStatus?.network?.status || "OPTIMIZED"}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <TourGuide />
              <div id="tour-wallet-connect">
                <WalletButton />
              </div>
            </div>
          </header>

          {/* Main Content with Transition - Responsive Padding */}
          <main className="flex-1 overflow-auto bg-background">
            <div className="container-custom py-4 md:py-6 lg:py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
