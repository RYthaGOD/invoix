import { useRef, useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function TourGuide() {
    const driverRef = useRef<any>(null);

    const startTour = () => {
        const allSteps = [
            // Landing Page Steps
            {
                element: '#tour-welcome',
                popover: {
                    title: 'Welcome to Invoix Protocol ⚡',
                    description: 'The world\'s first Confidential B2B Invoicing Platform on Solana. Fast, secure, and rewarding.',
                    side: "bottom" as const,
                    align: 'start' as const
                }
            },
            {
                element: '#hero-create-invoice',
                popover: {
                    title: 'Start Invoicing Now 🚀',
                    description: 'Ready to go? Click here to launch the app and create your first invoice in seconds.',
                    side: "bottom" as const
                }
            },
            {
                element: '#tour-create-invoice',
                popover: {
                    title: 'Create Your First Invoice 📝',
                    description: 'Click here to start. You can invoice in SOL, USDC, or USDT. Fees are just 0.0001 SOL (network cost).',
                    side: "right" as const
                }
            },

            // Dashboard Steps
            {
                element: '#tour-system-status',
                popover: {
                    title: 'System Security Status 🛡️',
                    description: 'This indicator shows that our Arcium Confidential Computing layer is active and protecting your data.',
                    side: "bottom" as const
                }
            },
            {
                element: '#tour-wallet-connect',
                popover: {
                    title: 'Connect Wallet to Access 💳',
                    description: 'You must connect your Solana wallet (Phantom, Solflare) to view encrypted invoices and sign transactions.',
                    side: "left" as const
                }
            },
            {
                element: '#nav-dashboard',
                popover: {
                    title: 'Access Your Dashboard 🚀',
                    description: 'Already have an account? Jump straight to your dashboard to manage invoices and clients.',
                    side: "bottom" as const
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

        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(0, 0, 0, 0.8)',
            steps: validSteps,
            onDestroyed: () => {
                driverRef.current = null;
            }
        });

        driverRef.current = driverObj;
        driverObj.drive();
    };

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
            <span className="hidden sm:inline">Tour</span>
        </Button>
    );
}
