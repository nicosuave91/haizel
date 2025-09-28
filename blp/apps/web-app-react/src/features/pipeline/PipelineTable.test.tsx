import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineTable } from "./PipelineTable";
import { generatePipelineData } from "./mocks/data";

describe("PipelineTable", () => {
  it("renders rows and triggers selection", async () => {
    const data = generatePipelineData(10);
    const handleSelect = vi.fn();
    render(<PipelineTable data={data} onSelectLoan={handleSelect} disableVirtualization />);

    const borrowerMatches = await screen.findAllByText(data[0].borrower);
    fireEvent.click(borrowerMatches[0].closest("tr")!);
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: data[0].id }));
  });
});
