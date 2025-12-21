
import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function TourGuide() {
    const driverObj = useRef<any>(null);

    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(0, 0, 0, 0.8)', // Darker overlay for Midnight Prism

            steps: [
                {
                    element: '#tour-welcome',
                    popover: {
                        title: 'Welcome to Invoix ⚡',
                        description: 'The world\'s first Confidential B2B Invoicing Platform on Solana. Let us show you around.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-system-status',
                    popover: {
                        title: 'System Security Status 🛡️',
                        description: 'This widget monitors our industrial hardening: Arcium Encryption, x402 Anti-Spam, and Atomic Sequencing.',
                        side: "bottom"
                    }
                },
                {
                    element: '#tour-create-invoice',
                    popover: {
                        title: 'Create Confidential Invoices 📝',
                        description: 'Start here. Invoices require a tiny 0.0001 SOL fee (x402 protocol) to prevent spam and verify business intent.',
                        side: "right"
                    }
                },
                {
                    element: '#tour-wallet-connect',
                    popover: {
                        title: 'Connect Your Wallet 💳',
                        description: 'Connect your Phantom or Solflare wallet to sign transactions and decrypt your private data via Arcium.',
                        side: "left"
                    }
                }
            ]
        });
    }, []);

    const startTour = () => {
        if (driverObj.current) {
            driverObj.current.drive();
        }
    };

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
