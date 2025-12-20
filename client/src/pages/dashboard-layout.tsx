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
  Server
} from "lucide-react";
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

import type { ReactNode, CSSProperties } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Generate breadcrumbs from path
  const pathSegments = location.split("/").filter((segment) => segment);

  return (
    <SidebarProvider style={style as CSSProperties}>
      <div className="flex h-screen w-full bg-background transition-colors duration-300">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header - Glass Effect */}
          <header className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 z-10 glass">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />

              {/* Dynamic Breadcrumbs */}
              <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/invoices" className="hover:text-primary transition-colors">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  {pathSegments.map((segment, index) => {
                    const path = `/${pathSegments.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathSegments.length - 1;
                    const title = segment.charAt(0).toUpperCase() + segment.slice(1);

                    return (
                      <Fragment key={path}>
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage className="font-semibold text-primary">{title}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link href={path} className="hover:text-primary transition-colors">{title}</Link>
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

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all group">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    <span>System Secure</span>
                    <ChevronDown className="w-3 h-3 text-emerald-500/50 group-hover:text-emerald-500 transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 glass-strong border-white/10 mt-2">
                  <DropdownMenuLabel className="flex items-center gap-2 text-white/90">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Hardened Protection
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />

                  <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs text-gray-300">Arcium MXE 0.5</span>
                      </div>
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] h-5">ACTIVE</Badge>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs text-gray-300">x402 Anti-Spam</span>
                      </div>
                      <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[10px] h-5">ACTIVE</Badge>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-gray-300">Anti-Replay Guard</span>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">SECURE</Badge>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs text-gray-300">Atomic Sequential</span>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] h-5">ENFORCED</Badge>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/5" />
                  <div className="p-3">
                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      NETWORK STATUS: OPTIMIZED
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <ThemeToggle />
              <WalletButton />
            </div>
          </header>

          {/* Main Content with Transition */}
          <main className="flex-1 overflow-auto p-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
