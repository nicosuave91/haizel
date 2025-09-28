import { format } from "date-fns";
import { DashboardCard } from "./DashboardCard";

interface RateLock {
  id: string;
  borrower: string;
  expires: string;
  delta: number;
}

interface RateLockWatchCardProps {
  locks: RateLock[];
}

export const RateLockWatchCard = ({ locks }: RateLockWatchCardProps) => {
  return (
    <DashboardCard title="Rate & Lock Watch" subtitle="Locks expiring soon">
      <ul className="space-y-2">
        {locks.map((lock) => (
          <li key={lock.id} className="flex items-center justify-between rounded-hz-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{lock.borrower}</p>
              <p className="text-xs text-hz-text-sub">Expires {format(new Date(lock.expires), "MMM d")}</p>
            </div>
            <span
              className={
                lock.delta >= 0
                  ? "rounded-hz-md bg-hz-success/10 px-2 py-1 text-xs font-semibold text-hz-success"
                  : "rounded-hz-md bg-hz-danger/10 px-2 py-1 text-xs font-semibold text-hz-danger"
              }
            >
              {lock.delta >= 0 ? "+" : ""}
              {lock.delta.toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};
