export const pipelineStageCounts = [
  { stage: "Lead", value: 32 },
  { stage: "App Started", value: 18 },
  { stage: "Disclosures Out", value: 12 },
  { stage: "Submitted", value: 9 },
  { stage: "Conditional Approval", value: 6 },
  { stage: "Clear to Close", value: 4 },
  { stage: "Funded", value: 2 }
];

export const taskQueue = [
  { id: "1", title: "Call borrower about appraisal", dueIn: "45m", type: "Call" },
  { id: "2", title: "Upload income docs", dueIn: "Due today", type: "Docs" },
  { id: "3", title: "Order HOA certificate", dueIn: "Due tomorrow", type: "Follow-up" },
  { id: "4", title: "Send disclosures", dueIn: "Due in 2d", type: "Compliance" },
  { id: "5", title: "Check lock extension", dueIn: "Due in 3d", type: "Pricing" }
];

export const rateLocks = [
  { id: "L-102", borrower: "Malik Carter", expires: "2024-04-22", delta: -0.12 },
  { id: "L-095", borrower: "Jules Patel", expires: "2024-04-23", delta: 0.03 },
  { id: "L-090", borrower: "Rivera Family", expires: "2024-04-24", delta: -0.08 }
];

export const conditions = [
  { id: "c1", owner: "Borrower", count: 4 },
  { id: "c2", owner: "Loan Officer", count: 2 },
  { id: "c3", owner: "Underwriter", count: 3 }
];

export const fundingCalendar = [
  { id: "f1", borrower: "Sasha & Eli", date: "2024-04-18", readiness: 0.7 },
  { id: "f2", borrower: "Lopez Family", date: "2024-04-19", readiness: 0.5 },
  { id: "f3", borrower: "Adams Townhome", date: "2024-04-20", readiness: 0.9 }
];

export const commsPulse = {
  unreadMessages: 8,
  unreadVendors: 3,
  unreadBorrowers: 5
};

export type ComplianceAlert = {
  id: string;
  title: string;
  severity: "danger" | "warning" | "info";
};

export const complianceAlerts: ComplianceAlert[] = [
  { id: "a1", title: "Heads up: Initial disclosures due in 6h", severity: "warning" },
  { id: "a2", title: "Action: TRID waiting on CD delivery", severity: "danger" },
  { id: "a3", title: "Assist: ECOA notice ready to send", severity: "info" }
];
