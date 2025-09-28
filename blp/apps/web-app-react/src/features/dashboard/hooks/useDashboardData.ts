import { useQuery } from "@tanstack/react-query";
import {
  commsPulse,
  complianceAlerts,
  conditions,
  fundingCalendar,
  pipelineStageCounts,
  rateLocks,
  taskQueue
} from "@/features/dashboard/mocks/data";

export const useDashboardData = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        pipelineStageCounts,
        taskQueue,
        rateLocks,
        conditions,
        fundingCalendar,
        commsPulse,
        complianceAlerts
      };
    }
  });
};
