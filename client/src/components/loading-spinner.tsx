import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    message?: string;
}

export function LoadingSpinner({ size = 'md', className = '', message }: LoadingSpinnerProps) {
    const sizes = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <Loader2 className={`${sizes[size]} animate-spin text-muted-foreground`} />
            {message && <p className="text-muted-foreground text-sm mt-3">{message}</p>}
        </div>
    );
}
