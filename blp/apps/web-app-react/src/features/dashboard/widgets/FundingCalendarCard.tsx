import { format } from "date-fns";
import { DashboardCard } from "./DashboardCard";

interface FundingItem {
  id: string;
  borrower: string;
  date: string;
  readiness: number;
}

interface FundingCalendarCardProps {
  items: FundingItem[];
}

export const FundingCalendarCard = ({ items }: FundingCalendarCardProps) => {
  return (
    <DashboardCard title="Funding Calendar" subtitle="This week’s closings">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="space-y-1 rounded-hz-md border px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{item.borrower}</p>
              <span className="text-xs text-hz-text-sub">{format(new Date(item.date), "EEE, MMM d")}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-hz-xs bg-hz-neutral-100">
              <div
                className="h-full rounded-hz-xs bg-hz-primary"
                style={{ width: `${Math.round(item.readiness * 100)}%` }}
              />
            </div>
            <p className="text-xs text-hz-text-sub">Readiness {Math.round(item.readiness * 100)}%</p>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};
