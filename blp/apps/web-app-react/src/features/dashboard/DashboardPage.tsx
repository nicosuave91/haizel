import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDashboardData } from "./hooks/useDashboardData";
import { PipelineOverviewCard } from "./widgets/PipelineOverviewCard";
import { TaskQueueCard } from "./widgets/TaskQueueCard";
import { RateLockWatchCard } from "./widgets/RateLockWatchCard";
import { ConditionsTrackerCard } from "./widgets/ConditionsTrackerCard";
import { FundingCalendarCard } from "./widgets/FundingCalendarCard";
import { CommsPulseCard } from "./widgets/CommsPulseCard";
import { ComplianceAlertsCard } from "./widgets/ComplianceAlertsCard";
import { FilterPills } from "@/features/shared/FilterPills";
import { usePipelineFilters } from "@/stores/pipeline.store";

const FILTERS = ["My loans", "Due today", "Overdue", "Recently updated"];

export const DashboardPage = () => {
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const { data, isLoading } = useDashboardData();
  const setPipelineStage = usePipelineFilters((state) => state.setStage);
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-hz-xl bg-hz-neutral-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Good afternoon, Jamie</h1>
          <p className="text-sm text-hz-text-sub">Here’s what’s moving across your pipeline.</p>
        </div>
        <FilterPills filters={FILTERS} active={activeFilter} onSelect={setActiveFilter} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PipelineOverviewCard
          data={data.pipelineStageCounts}
          onSelectStage={(stage) => {
            setPipelineStage(stage);
            navigate({ to: "/pipeline" });
          }}
        />
        <TaskQueueCard tasks={data.taskQueue} />
        <RateLockWatchCard locks={data.rateLocks} />
        <ConditionsTrackerCard items={data.conditions} />
        <FundingCalendarCard items={data.fundingCalendar} />
        <CommsPulseCard data={data.commsPulse} />
        <ComplianceAlertsCard alerts={data.complianceAlerts} />
      </div>
    </div>
  );
};
