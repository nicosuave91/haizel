import { DashboardCard } from "./DashboardCard";

interface CommsPulse {
  unreadMessages: number;
  unreadBorrowers: number;
  unreadVendors: number;
}

interface CommsPulseCardProps {
  data: CommsPulse;
}

export const CommsPulseCard = ({ data }: CommsPulseCardProps) => {
  return (
    <DashboardCard title="Comms Pulse" subtitle="Conversations needing attention">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-hz-md border bg-hz-neutral-100 p-4 text-center">
          <p className="text-xs text-hz-text-sub">Unread</p>
          <p className="text-2xl font-semibold">{data.unreadMessages}</p>
        </div>
        <div className="rounded-hz-md border bg-hz-neutral-100 p-4 text-center">
          <p className="text-xs text-hz-text-sub">Borrowers</p>
          <p className="text-2xl font-semibold">{data.unreadBorrowers}</p>
        </div>
        <div className="rounded-hz-md border bg-hz-neutral-100 p-4 text-center">
          <p className="text-xs text-hz-text-sub">Vendors</p>
          <p className="text-2xl font-semibold">{data.unreadVendors}</p>
        </div>
      </div>
    </DashboardCard>
  );
};
