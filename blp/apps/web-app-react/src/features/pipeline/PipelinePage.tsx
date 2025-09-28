import { useMemo, useState } from "react";
import { PipelineTable } from "./PipelineTable";
import { pipelineLoans, PipelineLoan } from "./mocks/data";
import { BorrowerDrawer } from "./drawer/BorrowerDrawer";
import { usePipelineFilters } from "@/stores/pipeline.store";
import { FilterPills } from "@/features/shared/FilterPills";

const FILTERS = ["All", "Lead", "App Started", "Disclosures Out", "Submitted", "Conditional Approval", "Clear to Close", "Funded"];

export const PipelinePage = () => {
  const { stage, setStage, search, setSearch } = usePipelineFilters();
  const [selectedLoan, setSelectedLoan] = useState<PipelineLoan | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredLoans = useMemo(() => {
    return pipelineLoans.filter((loan) => {
      const matchesStage = stage ? loan.stage === stage : true;
      const term = search.trim().toLowerCase();
      const matchesSearch = term
        ? [loan.borrower, loan.loanNumber, loan.assignedTo].some((value) => value.toLowerCase().includes(term))
        : true;
      return matchesStage && matchesSearch;
    });
  }, [stage, search]);

  const handleSelectLoan = (loan: PipelineLoan) => {
    setSelectedLoan(loan);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-hz-text-sub">Filter, triage, and open drawers inline.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search borrowers, loan #, or assignee"
            className="w-72 rounded-hz-md border bg-hz-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-hz-primary"
          />
        </div>
      </header>
        <FilterPills
          filters={FILTERS}
          active={stage ?? "All"}
          onSelect={(filter: string) => setStage(filter === "All" ? undefined : filter)}
        />
      <PipelineTable data={filteredLoans} onSelectLoan={handleSelectLoan} />
      <BorrowerDrawer loan={selectedLoan} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};
