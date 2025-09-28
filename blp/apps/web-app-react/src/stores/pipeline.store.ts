import { create } from "zustand";

interface PipelineFilterState {
  stage?: string;
  search: string;
  setStage: (stage?: string) => void;
  setSearch: (search: string) => void;
}

export const usePipelineFilters = create<PipelineFilterState>((set) => ({
  stage: undefined,
  search: "",
  setStage: (stage) => set({ stage }),
  setSearch: (search) => set({ search })
}));
