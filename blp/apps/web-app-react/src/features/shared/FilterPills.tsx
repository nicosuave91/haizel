interface FilterPillsProps {
  filters: string[];
  active: string;
  onSelect: (filter: string) => void;
}

export const FilterPills = ({ filters, active, onSelect }: FilterPillsProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const selected = filter === active;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onSelect(filter)}
            className={
              selected
                ? "rounded-full bg-hz-primary px-4 py-1 text-xs font-semibold text-white shadow-hz-sm"
                : "rounded-full border px-4 py-1 text-xs font-medium text-hz-text-sub"
            }
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
};
