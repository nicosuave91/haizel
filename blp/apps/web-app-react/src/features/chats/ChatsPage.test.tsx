import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatsPage } from "./ChatsPage";

describe("ChatsPage", () => {
  it("allows sending a message", async () => {
    render(<ChatsPage />);

    const input = await screen.findByPlaceholderText("Type a message, use @mentions, or insert a template");
    fireEvent.change(input, { target: { value: "Sending docs now" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("Sending docs now")).toBeInTheDocument();
  });
});
