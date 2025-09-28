import { DashboardCard } from "./DashboardCard";

interface Task {
  id: string;
  title: string;
  dueIn: string;
  type: string;
}

interface TaskQueueCardProps {
  tasks: Task[];
}

export const TaskQueueCard = ({ tasks }: TaskQueueCardProps) => {
  return (
    <DashboardCard title="Task Queue" subtitle="Knock out the next 5">
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-hz-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{task.title}</p>
              <p className="text-xs text-hz-text-sub">{task.type}</p>
            </div>
            <button className="rounded-hz-md bg-hz-primary px-3 py-1 text-xs font-semibold text-white shadow-hz-sm">
              {task.dueIn}
            </button>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};
