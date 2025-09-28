import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { DashboardCard } from "./DashboardCard";

interface AlertItem {
  id: string;
  title: string;
  severity: "danger" | "warning" | "info";
}

interface ComplianceAlertsCardProps {
  alerts: AlertItem[];
}

const iconMap = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  info: Info
} as const;

const toneMap = {
  danger: "text-hz-danger",
  warning: "text-hz-warning",
  info: "text-hz-info"
};

export const ComplianceAlertsCard = ({ alerts }: ComplianceAlertsCardProps) => {
  return (
    <DashboardCard title="Compliance Alerts" subtitle="Stay ahead of the clocks">
      <ul className="space-y-2">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.severity];
          return (
            <li key={alert.id} className="flex items-center gap-3 rounded-hz-md border px-3 py-2">
              <Icon className={`h-4 w-4 ${toneMap[alert.severity]}`} />
              <p className="text-sm font-medium">{alert.title}</p>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
};
