import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("User mode", () => {
  it("renders the preview chat by default", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /What can we help you figure out/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Message Untangle")).toBeInTheDocument();
  });

  it("validates an empty message and honestly reports the preview limitation", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Preview message" }));
    expect(screen.getByRole("status")).toHaveTextContent("Preview only");

    fireEvent.change(screen.getByLabelText("Message Untangle"), { target: { value: "How can I clarify this?" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview message" }));
    expect(screen.getByRole("status")).toHaveTextContent("Preview only");
  });
});
