import React from "react";
import { Link } from "wouter";
import { ArrowLeft, Rocket } from "lucide-react";

export default function ComingSoon() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Rocket className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold font-heading mb-4">Coming Soon</h1>
            <p className="text-muted-foreground text-lg max-w-md mb-8">
                We are working hard to bring you this feature. Stay tuned for the future of B2B invoicing!
            </p>
            <Link href="/invoices">
                <button className="btn-primary px-6 py-3 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>
            </Link>
        </div>
    );
}
