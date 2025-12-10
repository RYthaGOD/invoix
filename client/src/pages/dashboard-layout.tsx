import React, { Fragment } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useLocation, Link } from "wouter";
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
