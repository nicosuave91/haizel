import { DashboardCard } from "./DashboardCard";

interface PipelineOverviewCardProps {
  data: { stage: string; value: number }[];
  onSelectStage?: (stage: string) => void;
}

export const PipelineOverviewCard = ({ data, onSelectStage }: PipelineOverviewCardProps) => {
  return (
    <DashboardCard title="Pipeline Overview" subtitle="Your loans by stage">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.map((item) => (
          <li key={item.stage}>
            <button
              type="button"
              onClick={() => onSelectStage?.(item.stage)}
              className="flex w-full flex-col rounded-hz-md border bg-hz-neutral-100 px-4 py-3 text-left transition hover:border-hz-primary"
            >
              <span className="text-xs text-hz-text-sub">{item.stage}</span>
              <span className="text-2xl font-semibold">{item.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};
