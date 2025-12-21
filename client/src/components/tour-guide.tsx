
import { useRef, useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function TourGuide() {
    // We don't need to persist the driver instance if we create it on demand
    // but keeping a ref is fine if we want to programmatically close it later.
    const driverRef = useRef<any>(null);

    const startTour = () => {
        // Define all possible steps
        const allSteps = [
            {
                element: '#tour-welcome',
                popover: {
                    title: 'Welcome to Invoix ⚡',
                    description: 'The world\'s first Confidential B2B Invoicing Platform on Solana. Let us show you around.',
                    side: "bottom" as const,
                    align: 'start' as const
                }
            },
            {
                element: '#tour-system-status',
                popover: {
                    title: 'System Security Status 🛡️',
                    description: 'This widget monitors our industrial hardening: Arcium Encryption, x402 Anti-Spam, and Atomic Sequencing.',
                    side: "bottom" as const
                }
            },
            {
                element: '#tour-create-invoice',
                popover: {
                    title: 'Create Confidential Invoices 📝',
                    description: 'Start here. Invoices require a tiny 0.0001 SOL fee (x402 protocol) to prevent spam and verify business intent.',
                    side: "right" as const
                }
            },
            {
                element: '#tour-wallet-connect',
                popover: {
                    title: 'Connect Your Wallet 💳',
                    description: 'Connect your Phantom or Solflare wallet to sign transactions and decrypt your private data via Arcium.',
                    side: "left" as const
                }
            }
        ];

        // Filter steps based on element existence
        const validSteps = allSteps.filter(step => {
            return !!document.querySelector(step.element);
        });

        if (validSteps.length === 0) {
            console.warn("TourGuide: No tour steps available on this page.");
            return;
        }

        // Initialize driver only when starting the tour
        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(0, 0, 0, 0.8)', // Darker overlay for Midnight Prism
            steps: validSteps,
            onDestroyed: () => {
                driverRef.current = null;
            }
        });

        driverRef.current = driverObj;
        driverObj.drive();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };
    }, []);

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={startTour}
            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
            <HelpCircle className="h-4 w-4" />
            <span>Tour</span>
        </Button>
    );
}
