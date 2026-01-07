import { ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { Fragment } from 'react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-muted-foreground">
            {items.map((item, index) => (
                <Fragment key={index}>
                    {index > 0 && <ChevronRight className="h-4 w-4" />}
                    {item.href && index < items.length - 1 ? (
                        <Link href={item.href}>
                            <a className="hover:text-foreground transition-colors">{item.label}</a>
                        </Link>
                    ) : (
                        <span className={index === items.length - 1 ? 'text-foreground font-medium' : ''}>
                            {item.label}
                        </span>
                    )}
                </Fragment>
            ))}
        </nav>
    );
}
