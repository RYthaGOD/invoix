import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        We encountered an unexpected error. Please try refreshing the page.
                    </p>

                    <div className="bg-black/30 p-4 rounded-lg border border-white/10 mb-6 text-left w-full max-w-2xl overflow-auto max-h-60">
                        <p className="font-mono text-xs text-red-400 mb-2">{this.state.error?.toString()}</p>
                        <pre className="font-mono text-xs text-gray-500 whitespace-pre-wrap">
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary px-6 py-2 flex items-center gap-2"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
