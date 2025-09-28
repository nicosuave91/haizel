import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { format } from "date-fns";
import { PipelineLoan } from "../mocks/data";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeDate } from "@/lib/utils";

interface BorrowerDrawerProps {
  loan?: PipelineLoan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BorrowerDrawer = ({ loan, open, onOpenChange }: BorrowerDrawerProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-[var(--hz-surface-card)] p-6 shadow-hz-lg focus:outline-none">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold">{loan?.borrower}</Dialog.Title>
              <Dialog.Description className="text-sm text-hz-text-sub">
                Loan {loan?.loanNumber} · {loan?.program} {loan?.product}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full border px-3 py-1 text-sm">Close</Dialog.Close>
          </div>
          {loan ? (
            <Tabs.Root defaultValue="summary" className="space-y-4">
              <Tabs.List className="flex flex-wrap gap-2 border-b pb-2">
                {tabs.map((tab) => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-hz-md border px-3 py-1 text-xs font-semibold data-[state=active]:bg-hz-primary data-[state=active]:text-white"
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="summary" className="space-y-4">
                <section className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-hz-text-sub">Stage</p>
                    <Badge tone="primary">{loan.stage}</Badge>
                  </div>
                  <div>
                    <p className="text-hz-text-sub">Substatus</p>
                    <p>{loan.substatus}</p>
                  </div>
                  <div>
                    <p className="text-hz-text-sub">Milestone</p>
                    <p>{loan.milestone}%</p>
                  </div>
                  <div>
                    <p className="text-hz-text-sub">Lock</p>
                    <p>
                      {loan.lockStatus} · Exp {format(new Date(loan.lockExpires), "MMM d")}
                    </p>
                  </div>
                  <div>
                    <p className="text-hz-text-sub">Closing</p>
                    <p>{format(new Date(loan.closingDate), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-hz-text-sub">Last activity</p>
                    <p>{formatRelativeDate(loan.lastActivity)}</p>
                  </div>
                </section>
                <section className="space-y-2 rounded-hz-md bg-hz-neutral-100 p-4">
                  <p className="text-sm font-semibold">Next Steps</p>
                  <ul className="space-y-2 text-sm text-hz-text-sub">
                    <li>Action: Upload income docs to unlock underwriting.</li>
                    <li>Assist: We’ll highlight exactly what’s missing.</li>
                    <li>Heads up: Appraisal needs verification.</li>
                  </ul>
                </section>
              </Tabs.Content>
              <Tabs.Content value="documents" className="space-y-3 text-sm">
                <p className="text-hz-text-sub">Documents collected for this loan. Mock data only.</p>
                <ul className="space-y-2">
                  {mockDocuments.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between rounded-hz-md border px-3 py-2">
                      <div>
                        <p className="font-semibold">{doc.title}</p>
                        <p className="text-xs text-hz-text-sub">{doc.status}</p>
                      </div>
                      <button className="rounded-hz-md border px-3 py-1 text-xs">Request</button>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
              <Tabs.Content value="conditions" className="space-y-2 text-sm">
                <p className="text-hz-text-sub">Open conditions tracked in workflow.</p>
                <ul className="space-y-2">
                  {mockConditions.map((condition) => (
                    <li key={condition.id} className="rounded-hz-md border px-3 py-2">
                      <p className="font-semibold">{condition.title}</p>
                      <p className="text-xs text-hz-text-sub">Owner: {condition.owner}</p>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
              <Tabs.Content value="comms" className="space-y-3 text-sm">
                <p className="text-hz-text-sub">Latest communication threads.</p>
                <ul className="space-y-2">
                  {mockComms.map((comm) => (
                    <li key={comm.id} className="rounded-hz-md border px-3 py-2">
                      <p className="font-semibold">{comm.author}</p>
                      <p className="text-xs text-hz-text-sub">{comm.preview}</p>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
              <Tabs.Content value="tasks" className="space-y-2 text-sm">
                <p className="text-hz-text-sub">Tasks in flight.</p>
                <ul className="space-y-2">
                  {mockTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between rounded-hz-md border px-3 py-2">
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-xs text-hz-text-sub">Due {task.due}</p>
                      </div>
                      <button className="rounded-hz-md bg-hz-primary px-3 py-1 text-xs font-semibold text-white">Mark done</button>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
              <Tabs.Content value="pricing" className="space-y-2 text-sm">
                <p>Last AUS: {loan.aus}</p>
                <p className="text-hz-text-sub">Pricing scenario links will surface here.</p>
              </Tabs.Content>
              <Tabs.Content value="compliance" className="space-y-2 text-sm">
                <p className="text-hz-text-sub">Compliance clocks summary.</p>
                <ul className="space-y-2">
                  {mockCompliance.map((item) => (
                    <li key={item.id} className="rounded-hz-md border px-3 py-2">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-hz-text-sub">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
            </Tabs.Root>
          ) : (
            <p className="text-sm text-hz-text-sub">Select a loan to view details.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const tabs = [
  { value: "summary", label: "Summary" },
  { value: "documents", label: "Documents" },
  { value: "conditions", label: "Conditions" },
  { value: "comms", label: "Comms" },
  { value: "tasks", label: "Tasks" },
  { value: "pricing", label: "Pricing & AUS" },
  { value: "compliance", label: "Compliance" }
] as const;

const mockDocuments = [
  { id: "d1", title: "Income docs", status: "Waiting on borrower" },
  { id: "d2", title: "Appraisal", status: "Scheduled" },
  { id: "d3", title: "HOI", status: "Received" }
];

const mockConditions = [
  { id: "c1", title: "Gift letter", owner: "Borrower" },
  { id: "c2", title: "Updated VOE", owner: "Processor" }
];

const mockComms = [
  { id: "m1", author: "Borrower", preview: "Sent updated paystubs." },
  { id: "m2", author: "Processor", preview: "Heads up: Appraisal scheduled for Friday." }
];

const mockTasks = [
  { id: "t1", title: "Upload 2023 W2", due: "Today" },
  { id: "t2", title: "Send closing disclosure", due: "Tomorrow" }
];

const mockCompliance = [
  { id: "p1", title: "TRID", detail: "CD must be acknowledged in 24h" },
  { id: "p2", title: "ECOA", detail: "Adverse action clock paused" }
];
