import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { submitSupportQuery } from "./actions";
import HomePage from "./page";

vi.mock("./actions", () => ({ submitSupportQuery: vi.fn() }));

describe("User mode", () => {
  it("renders the Write Query page by default", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Write Query" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your query")).toBeInTheDocument();
  });

  it("validates an empty query and reports the evaluated decision", async () => {
    vi.mocked(submitSupportQuery).mockResolvedValue({
      query: "How can I clarify this?",
      context: { status: "OPEN" },
      decision: {
        evaluationId: "evaluation-1",
        evaluatedAt: "2026-01-01T00:00:00.000Z",
        status: "VALID",
        recommendation: "NO_MATCH",
        matchedRules: [],
        nonMatchingRules: [],
        proposedActions: [],
        conflicts: [],
        validationErrors: [],
      },
      persisted: true,
      ticket: { id: "ticket-1", referenceNumber: "T-1" },
    });
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit query" }));
    expect(screen.getByRole("status")).toHaveTextContent("Please write a query");

    fireEvent.change(screen.getByLabelText("Your query"), { target: { value: "How can I clarify this?" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit query" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Ticket T-1 created."));
    expect(screen.getByRole("heading", { name: "Decision: NO MATCH" })).toBeInTheDocument();
  });
});
