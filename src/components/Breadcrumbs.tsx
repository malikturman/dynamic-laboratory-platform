import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-600" aria-label="Навигационная цепочка">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.to ? (
            <Link className="focus-ring rounded text-laboratory-blue hover:text-laboratory-navy" to={item.to}>
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-laboratory-ink">{item.label}</span>
          )}
          {index < items.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" /> : null}
        </span>
      ))}
    </nav>
  );
}
