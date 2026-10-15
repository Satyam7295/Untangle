import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("User mode", () => {
  it("renders the Write Query page by default", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Write Query" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your query")).toBeInTheDocument();
  });

  it("validates an empty query and honestly reports the shell limitation", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit query" }));
    expect(screen.getByRole("status")).toHaveTextContent("Please write a query");

    fireEvent.change(screen.getByLabelText("Your query"), { target: { value: "How can I clarify this?" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit query" }));
    expect(screen.getByRole("status")).toHaveTextContent("not available yet");
  });
});
