import { useRef, useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from "@/components/ui/button";
import { HelpCircle, Sparkles } from "lucide-react";
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
    const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

    // Initial check for welcome tour
    useEffect(() => {
        const seen = localStorage.getItem('invoix_welcome_tour_seen');
        if (seen) setHasSeenWelcome(true);
    }, []);

    // 1. Landing Page / Fallback Steps
    const landingSteps: DriveStep[] = [
        {
            element: '#tour-welcome',
            popover: {
                title: 'Welcome to the Future of Invoicing ✨',
                description: 'Experience the power of Solana payments. Fast, secure, and designed for modern business.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#hero-create-invoice',
            popover: {
                title: 'Start Getting Paid 🚀',
                description: 'Launch the app to create your first blockchain-verified invoice. No wallet? No problem, we\'ll guide you.',
                side: "bottom"
            }
        },
        {
            element: '#tour-create-invoice',
            popover: {
                title: 'Instant Billing ⚡',
                description: 'Create a professional invoice in seconds. Get paid in USDC or SOL instantly.',
                side: "right"
            }
        },
        {
            element: '#tour-wallet-connect',
            popover: {
                title: 'Your Digital Vault 🔐',
                description: 'Connect your wallet to sign in securely. It\'s safe, private, and you own your data completely.',
                side: "left"
            }
        }
    ];

    // 2. Dashboard Steps (List View)
    const dashboardSteps: DriveStep[] = [
        {
            element: '#tour-welcome',
            popover: {
                title: 'Command Center 📊',
                description: 'This is your financial hub. Track every invoice, payment, and subscription in real-time.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#tour-stats-overview',
            popover: {
                title: 'Pulse Check 📈',
                description: 'Your key metrics at a glance. Spot overdue payments and cash flow trends instantly.',
                side: "bottom"
            }
        },
        {
            element: '#tour-create-invoice',
            popover: {
                title: 'New Opportunity ➕',
                description: 'Ready to bill? Click here to draft a smart invoice that handles payments automatically.',
                side: "left"
            }
        },
        {
            element: '#tour-invoice-table',
            popover: {
                title: 'Ledger View 📝',
                description: 'Your complete history. manage status, download PDFs, or mint NFTs for proof-of-business.',
                side: "top"
            }
        },
        {
            element: '#tour-system-status',
            popover: {
                title: 'Fortress Security 🛡️',
                description: 'State-of-the-art protection active. Arcium Confidential Computing ensures your data stays private.',
                side: "bottom"
            }
        }
    ];

    // 3. Create Invoice Steps
    const createInvoiceSteps: DriveStep[] = [
        {
            element: '#tour-client-select',
            popover: {
                title: 'Select Recipient 👤',
                description: 'Enter your client\'s wallet address. It\'s like their digital email for money.',
                side: "right"
            }
        },
        {
            element: '#tour-currency-select',
            popover: {
                title: 'Choose Payment 💰',
                description: 'Get paid in stable USDC or SOL. Rates are locked at creation to prevent volatility.',
                side: "right"
            }
        },
        {
            element: '#tour-items-section',
            popover: {
                title: 'Itemize Services 📋',
                description: 'Add line items for clarity. Calculations for tax and discounts are handled automatically.',
                side: "top"
            }
        },
        {
            element: '#tour-mint-settings',
            popover: {
                title: 'Smart Features 🧠',
                description: 'Enable "Private Invoice" for confidentiality or "Mint NFT" for an immutable on-chain record.',
                side: "top"
            }
        }
    ];

    // 4. Marketplace Steps
    const marketplaceSteps: DriveStep[] = [
        {
            element: '#tour-marketplace-listings',
            popover: {
                title: 'Invoice Marketplace 🏪',
                description: 'Browse verified invoices listed for sale. Purchase at a discount to earn yield on payment.',
                side: "bottom"
            }
        },
        {
            element: '#tour-marketplace-filter',
            popover: {
                title: 'Smart Filters 🔍',
                description: 'Find the perfect opportunity. Filter by Risk Score, Yield, or Asset Type.',
                side: "bottom"
            }
        },
        {
            element: '#tour-marketplace-buy',
            popover: {
                title: 'Instant Purchase ⚡',
                description: 'Buy invoices instantly with smart contract security. Revenue is routed directly to your wallet.',
                side: "left"
            }
        }
    ];

    // 5. Subscription Steps
    const subscriptionSteps: DriveStep[] = [
        {
            element: '#tour-subscription-create',
            popover: {
                title: 'Recurring Revenue 🔄',
                description: 'Set up automated billing cycles. Perfect for retainers and SaaS pricing.',
                side: "left"
            }
        },
        {
            element: '#tour-subscription-active',
            popover: {
                title: 'Active Streams 🌊',
                description: 'Monitor your active subscriptions. Payments are automatically pulled and settled on-chain.',
                side: "top"
            }
        }
    ];

    // 6. Tax Reports Steps
    const taxReportSteps: DriveStep[] = [
        {
            element: '#tour-tax-year-select',
            popover: {
                title: 'Tax Periods 📅',
                description: 'Select accurate reporting periods for your financial records.',
                side: "right"
            }
        },
        {
            element: '#tour-tax-export-csv',
            popover: {
                title: 'Data Export 📥',
                description: 'Download comprehensive CSV reports compatible with major accounting software.',
                side: "bottom"
            }
        }
    ];

    // 7. Customers Steps
    const customerSteps: DriveStep[] = [
        {
            element: '#tour-add-customer',
            popover: {
                title: 'Build Relationships 🤝',
                description: 'Save customer profiles for faster invoicing. Track lifetime value per client.',
                side: "left"
            }
        },
        {
            element: '#tour-customer-list',
            popover: {
                title: 'CRM Lite 📇',
                description: 'Your business rolodex. Click any card to instantly start a new invoice for that client.',
                side: "top"
            }
        }
    ];

    // 8. Settings Steps
    const settingsSteps: DriveStep[] = [
        {
            element: '#tour-profile-settings',
            popover: {
                title: 'Business Identity 🆔',
                description: 'Manage your on-chain presence. This is how the world sees your business.',
                side: "bottom"
            }
        },
        {
            element: '#tour-identity-verification',
            popover: {
                title: 'Trust Badge ✅',
                description: 'Mint your verified Identity NFT. Increases trust and unlocks lower platform fees.',
                side: "top"
            }
        }
    ];

    const getStepsForRoute = (path: string): DriveStep[] => {
        if (path.includes('/marketplace')) return marketplaceSteps;
        if (path.includes('/subscriptions')) return subscriptionSteps;
        if (path.includes('/tax-reports')) return taxReportSteps;
        if (path.includes('/invoices/create')) return createInvoiceSteps;
        if (path.includes('/customers')) return customerSteps;
        if (path.includes('/settings')) return settingsSteps;
        if (path === '/invoices' || path === '/dashboard') return dashboardSteps;

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
            overlayColor: 'rgba(0, 0, 0, 0.85)', // Darker overlay for focus
            popoverClass: 'driver-popover-premium', // Custom premium class
            steps: validSteps,
            onDestroyed: () => {
                driverRef.current = null;
                // Mark as seen if it was the welcome tour
                if (location === '/invoices/create' || location === '/dashboard') {
                    localStorage.setItem('invoix_welcome_tour_seen', 'true');
                    setHasSeenWelcome(true);
                }
            },
            nextBtnText: 'Next →',
            prevBtnText: '← Back',
            doneBtnText: 'Complete ✨'
        });

        driverRef.current = driverObj;
        driverObj.drive();
    };

    // Auto-trigger for new users on create invoice page
    useEffect(() => {
        if (!hasSeenWelcome && (location === '/invoices/create' || location === '/dashboard')) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                // Double check it hasn't run
                if (!driverRef.current) {
                    startTour();
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [location, hasSeenWelcome]);

    useEffect(() => {
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };
    }, []);

    // Helper to determine button text based on context
    const getButtonText = () => {
        return 'Guide';
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={startTour}
            className="gap-2 text-muted-foreground hover:text-primary hover:bg-white/5 transition-all duration-300"
        >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">{getButtonText()}</span>
        </Button>
    );
}
