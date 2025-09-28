import { DashboardCard } from "./DashboardCard";

interface ConditionSummary {
  id: string;
  owner: string;
  count: number;
}

interface ConditionsTrackerCardProps {
  items: ConditionSummary[];
}

export const ConditionsTrackerCard = ({ items }: ConditionsTrackerCardProps) => {
  const total = items.reduce((acc, item) => acc + item.count, 0);
  return (
    <DashboardCard title="Conditions Tracker" subtitle={`Open conditions: ${total}`}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-hz-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{item.owner}</p>
              <p className="text-xs text-hz-text-sub">Owner</p>
            </div>
            <span className="rounded-full bg-hz-neutral-100 px-3 py-1 text-sm font-semibold">{item.count}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};
