import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PipelineLoan } from "./mocks/data";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { cn, formatRelativeDate } from "@/lib/utils";

interface PipelineTableProps {
  data: PipelineLoan[];
  onSelectLoan: (loan: PipelineLoan) => void;
  disableVirtualization?: boolean;
}

const complianceTone = {
  ok: "bg-hz-success/10 text-hz-success",
  warn: "bg-hz-warning/10 text-hz-warning",
  block: "bg-hz-danger/10 text-hz-danger"
};

export const PipelineTable = ({ data, onSelectLoan, disableVirtualization = false }: PipelineTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<PipelineLoan>[]>(
    () => [
      {
        header: "Borrower",
        accessorKey: "borrower",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{row.original.borrower}</p>
            {row.original.coBorrower && (
              <p className="text-xs text-hz-text-sub">Co: {row.original.coBorrower}</p>
            )}
          </div>
        )
      },
      {
        header: "Loan #",
        accessorKey: "loanNumber"
      },
      {
        header: "Program",
        cell: ({ row }) => (
          <div className="text-xs">
            <p className="font-semibold">{row.original.program}</p>
            <p className="text-hz-text-sub">{row.original.product}</p>
          </div>
        )
      },
      {
        header: "Purpose",
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{row.original.purpose}</p>
            <p className="text-hz-text-sub">{row.original.propertyType}</p>
          </div>
        )
      },
      {
        header: "Stage",
        accessorKey: "stage",
        cell: ({ row }) => (
          <div className="space-y-1">
            <Badge>{row.original.stage}</Badge>
            <p className="text-xs text-hz-text-sub">{row.original.substatus}</p>
          </div>
        )
      },
      {
        header: "Milestone",
        accessorKey: "milestone",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 overflow-hidden rounded-hz-xs bg-hz-neutral-100">
              <div
                className="h-full rounded-hz-xs bg-hz-primary"
                style={{ width: `${row.original.milestone}%` }}
              />
            </div>
            <span className="text-xs text-hz-text-sub">{row.original.milestone}%</span>
          </div>
        )
      },
      {
        header: "Lock",
        cell: ({ row }) => (
          <div className="text-xs">
            <p className="font-semibold">{row.original.lockStatus}</p>
            <p className="text-hz-text-sub">Exp {format(new Date(row.original.lockExpires), "MMM d")}</p>
          </div>
        )
      },
      {
        header: "Risk",
        cell: ({ row }) => (
          <div className="flex gap-2 text-[10px] font-semibold">
            <span className="rounded-full bg-hz-neutral-100 px-2 py-1">LTV {row.original.ltv}%</span>
            <span className="rounded-full bg-hz-neutral-100 px-2 py-1">DTI {row.original.dti}%</span>
            <span className="rounded-full bg-hz-neutral-100 px-2 py-1">FICO {row.original.fico}</span>
          </div>
        )
      },
      {
        header: "Closing",
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{format(new Date(row.original.closingDate), "MMM d, yyyy")}</p>
            <p className="text-hz-text-sub">{row.original.assignedTo}</p>
          </div>
        )
      },
      {
        header: "Tasks",
        accessorKey: "tasksDue",
        cell: ({ row }) => <span>{row.original.tasksDue}</span>
      },
      {
        header: "Last Activity",
        cell: ({ row }) => <span className="text-xs text-hz-text-sub">{formatRelativeDate(row.original.lastActivity)}</span>
      },
      {
        header: "Conditions",
        accessorKey: "conditionsOpen"
      },
      {
        header: "Compliance",
        cell: ({ row }) => (
          <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", complianceTone[row.original.compliance])}>
            {row.original.compliance.toUpperCase()}
          </span>
        )
      },
      {
        header: "AUS",
        accessorKey: "aus"
      }
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true
  });

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current ?? (typeof document !== "undefined" ? document.body : null),
    estimateSize: () => 72,
    overscan: 12
  });

  return (
    <div className="rounded-hz-xl bg-[var(--hz-surface-card)] shadow-hz-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <p className="text-xs text-hz-text-sub">Showing {data.length} loans</p>
      </div>
      <div className="overflow-hidden">
        <div
          ref={tableContainerRef}
          className="h-[560px] overflow-auto"
        >
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--hz-surface-card)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-hz-text-sub"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: " ↑",
                          desc: " ↓"
                        }[header.column.getIsSorted() as "asc" | "desc"] ?? null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              {disableVirtualization ? (
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b bg-[var(--hz-surface-card)] hover:bg-hz-neutral-100"
                      onClick={() => onSelectLoan(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="min-w-[140px] px-4 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={(node) => node && virtualizer.measureElement(node)}
                        className="absolute top-0 left-0 flex w-full cursor-pointer border-b bg-[var(--hz-surface-card)] hover:bg-hz-neutral-100"
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                        onClick={() => onSelectLoan(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="min-w-[140px] px-4 py-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
        </div>
      </div>
    </div>
  );
};
