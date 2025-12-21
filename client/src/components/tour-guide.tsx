import { useRef, useEffect } from 'react';
// @ts-ignore
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useLocation } from "wouter";

// Define Step Type
type DriveStep = {
    element: string;
    popover: {
        title: string;
        description: string;
        side?: "top" | "right" | "bottom" | "left";
        align?: "start" | "center" | "end";
    }
};

export function TourGuide() {
    const driverRef = useRef<any>(null);
    const [location] = useLocation();

    // 1. Landing Page / Fallback Steps
    const landingSteps: DriveStep[] = [
        {
            element: '#tour-welcome',
            popover: {
                title: 'Welcome to Invoix Protocol ⚡',
                description: 'The world\'s first Confidential B2B Invoicing Platform on Solana. Fast, secure, and rewarding.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#hero-create-invoice',
            popover: {
                title: 'Start Invoicing Now 🚀',
                description: 'Ready to go? Click here to launch the app and create your first invoice in seconds.',
                side: "bottom"
            }
        },
        {
            element: '#tour-create-invoice',
            popover: {
                title: 'Create Your First Invoice 📝',
                description: 'Click here to start. You can invoice in SOL, USDC, or USDT. Fees are just 0.0001 SOL (network cost).',
                side: "right"
            }
        },
        {
            element: '#tour-wallet-connect',
            popover: {
                title: 'Connect Wallet to Access 💳',
                description: 'You must connect your Solana wallet (Phantom, Solflare) to view encrypted invoices and sign transactions.',
                side: "left"
            }
        }
    ];

    // 2. Dashboard Steps (List View)
    const dashboardSteps: DriveStep[] = [
        {
            element: '#tour-welcome',
            popover: {
                title: 'Your Dashboard 📊',
                description: 'Overview of all your sent and received invoices.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#tour-stats-overview',
            popover: {
                title: 'Quick Stats 📈',
                description: 'Track total invoices, sent/received counts, and overdue items at a glance.',
                side: "bottom"
            }
        },
        {
            element: '#tour-create-invoice',
            popover: {
                title: 'Create New Invoice ➕',
                description: 'Click here to draft a new invoice for your client.',
                side: "left"
            }
        },
        {
            element: '#tour-invoice-table',
            popover: {
                title: 'Invoice List 📝',
                description: 'Manage your invoices here. Click on any row to view details, pay, or download PDF.',
                side: "top"
            }
        },
        {
            element: '#tour-system-status',
            popover: {
                title: 'System Security 🛡️',
                description: 'Green indicates our Arcium Confidential Computing nodes are active and securing your data.',
                side: "bottom"
            }
        }
    ];

    // 3. Create Invoice Steps
    const createInvoiceSteps: DriveStep[] = [
        {
            element: '#tour-client-select',
            popover: {
                title: 'Customer Details 👤',
                description: 'Enter the Customer\'s Solana Wallet Address here. This is who will receive the invoice.',
                side: "right"
            }
        },
        {
            element: '#tour-currency-select',
            popover: {
                title: 'Select Currency 💰',
                description: 'Choose payment token (USDC, SOL, EURC). The exchange rate is locked at time of creation.',
                side: "right"
            }
        },
        {
            element: '#tour-items-section',
            popover: {
                title: 'Line Items 📋',
                description: 'Add products or services here. We automatically calculate totals and taxes.',
                side: "top"
            }
        },
        {
            element: '#tour-mint-settings',
            popover: {
                title: 'Privacy & NFTs 🔐',
                description: 'Toggle "Private Invoice" to mask data on-chain, or "Mint NFT" to create a permanent invoice record.',
                side: "top"
            }
        }
    ];

    // 4. Customers Steps
    const customerSteps: DriveStep[] = [
        {
            element: '#tour-add-customer',
            popover: {
                title: 'Add New Customer 👥',
                description: 'Save frequently used customer profiles for quick access later.',
                side: "left"
            }
        },
        {
            element: '#tour-customer-list',
            popover: {
                title: 'Customer Directory 📂',
                description: 'View and manage your saved customers. Click "Create Invoice" on any card to start drafting.',
                side: "top"
            }
        }
    ];

    // 5. Settings Steps
    const settingsSteps: DriveStep[] = [
        {
            element: '#tour-profile-settings',
            popover: {
                title: 'Business Profile 🏢',
                description: 'Manage your business identity here. This information appears on your invoices.',
                side: "bottom"
            }
        },
        {
            element: '#tour-profile-name',
            popover: {
                title: 'Business Name 🏷️',
                description: 'Enter your legal business or trade name.',
                side: "right"
            }
        },
        {
            element: '#tour-profile-email',
            popover: {
                title: 'Contact Email 📧',
                description: 'Where should customers contact you? This is optional but recommended.',
                side: "right"
            }
        },
        {
            element: '#tour-profile-save',
            popover: {
                title: 'Save Profile 💾',
                description: 'Don\'t forget to save your changes! You must save a profile before you can mint your identity.',
                side: "top"
            }
        },
        {
            element: '#tour-identity-verification',
            popover: {
                title: 'On-Chain Verification ✅',
                description: 'Establish trust by minting an Identity NFT. This proves your wallet owns this business profile.',
                side: "top"
            }
        },
        {
            element: '#tour-identity-mint-btn',
            popover: {
                title: 'Mint Your Badge 🏅',
                description: 'Click here to mint. It costs a small network fee (~0.008 SOL) and is non-transferable.',
                side: "left"
            }
        }
    ];

    const getStepsForRoute = (path: string): DriveStep[] => {
        // Dashboard / Invoice List
        if (path === '/invoices' || path === '/dashboard') {
            return dashboardSteps;
        }
        // Create Invoice
        if (path.includes('/invoices/create')) {
            return createInvoiceSteps;
        }
        // Customers
        if (path.includes('/customers')) {
            return customerSteps;
        }
        // Settings
        if (path.includes('/settings')) {
            return settingsSteps;
        }
        // Landing Page (Root)
        if (path === '/' || path === '') {
            return landingSteps;
        }

        // Default to landing steps if no match (or could return empty)
        return landingSteps;
    };

    const startTour = () => {
        const stepsToUse = getStepsForRoute(location);

        // Filter steps based on element existence
        const validSteps = stepsToUse.filter(step => {
            return !!document.querySelector(step.element);
        });

        if (validSteps.length === 0) {
            console.warn(`TourGuide: No tour steps available for route ${location}`);
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

    // Helper to determine button text based on context
    const getButtonText = () => {
        if (location === '/') return 'Tour';
        return 'Page Guide';
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={startTour}
            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{getButtonText()}</span>
        </Button>
    );
}
