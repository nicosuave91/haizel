import { PropsWithChildren, ReactNode } from "react";
import { Ellipsis } from "lucide-react";

interface DashboardCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const DashboardCard = ({ title, subtitle, action, children }: DashboardCardProps) => {
  return (
    <section className="rounded-hz-xl bg-[var(--hz-surface-card)] p-4 shadow-hz-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-hz-text-sub">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button type="button" className="rounded-full border p-1 text-hz-text-sub" aria-label="Widget settings">
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>
      </header>
      {children}
    </section>
  );
};
