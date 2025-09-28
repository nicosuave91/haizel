import { addDays, subDays } from "date-fns";

export interface PipelineLoan {
  id: string;
  borrower: string;
  coBorrower?: string;
  loanNumber: string;
  program: string;
  product: string;
  purpose: string;
  propertyType: string;
  stage: string;
  substatus: string;
  milestone: number;
  lockStatus: string;
  lockExpires: string;
  ltv: number;
  dti: number;
  fico: number;
  closingDate: string;
  assignedTo: string;
  tasksDue: number;
  lastActivity: string;
  conditionsOpen: number;
  compliance: "ok" | "warn" | "block";
  aus: string;
}

const names = [
  "Rivera Family",
  "Malik Carter",
  "Sasha & Eli",
  "Jules Patel",
  "Amelia Chen",
  "Lopez Household",
  "Carson Team",
  "Riya & Mateo"
];

const programs = ["Conventional", "FHA", "VA", "USDA"];
const products = ["30Y Fixed", "15Y Fixed", "7/1 ARM"];
const purposes = ["Purchase", "Refinance"];
const propertyTypes = ["Single Family", "Condo", "Townhome"];
export const stages = [
  "Lead",
  "App Started",
  "Disclosures Out",
  "Submitted",
  "Conditional Approval",
  "Clear to Close",
  "Funded"
];
const substatuses = ["Collecting docs", "Needs review", "In underwriting", "Sign docs"];
const complianceStates: PipelineLoan["compliance"][] = ["ok", "warn", "block"];
const ausDecisions = ["Approve/Eligible", "Refer", "Caution"];

export const generatePipelineData = (count = 120): PipelineLoan[] => {
  return Array.from({ length: count }).map((_, index) => {
    const borrower = names[index % names.length];
    const stage = stages[index % stages.length];
    const milestone = Math.min(100, (index % 10) * 10 + 30);
    return {
      id: `loan-${index + 1}`,
      borrower,
      coBorrower: index % 3 === 0 ? "Jamie" : undefined,
      loanNumber: `HZ-${1000 + index}`,
      program: programs[index % programs.length],
      product: products[index % products.length],
      purpose: purposes[index % purposes.length],
      propertyType: propertyTypes[index % propertyTypes.length],
      stage,
      substatus: substatuses[index % substatuses.length],
      milestone,
      lockStatus: milestone > 60 ? "Locked" : "Floating",
      lockExpires: addDays(new Date(), (index % 6) + 1).toISOString(),
      ltv: 70 + (index % 20),
      dti: 32 + (index % 15),
      fico: 640 + (index % 80),
      closingDate: addDays(new Date(), (index % 20) + 2).toISOString(),
      assignedTo: index % 2 === 0 ? "Jamie" : "Morgan",
      tasksDue: index % 4,
      lastActivity: subDays(new Date(), index % 5).toISOString(),
      conditionsOpen: index % 6,
      compliance: complianceStates[index % complianceStates.length],
      aus: ausDecisions[index % ausDecisions.length]
    };
  });
};

export const pipelineLoans = generatePipelineData();
