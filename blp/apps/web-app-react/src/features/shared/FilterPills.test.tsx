import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPills } from "./FilterPills";

describe("FilterPills", () => {
  it("calls onSelect when a pill is clicked", () => {
    const onSelect = vi.fn();
    render(<FilterPills filters={["All", "My loans"]} active="All" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("My loans"));
    expect(onSelect).toHaveBeenCalledWith("My loans");
  });
});
