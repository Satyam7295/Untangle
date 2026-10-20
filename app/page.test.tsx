import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

describe("User mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chat by default", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /What can we help you figure out/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Message Untangle")).toBeInTheDocument();
  });

  it("validates an empty message", () => {
    render(<HomePage />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Message Untangle"), { target: { value: "How can I clarify this?" } });
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  it("submits a query and renders the grounded answer and source labels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "INTERPRETED",
      answer: "Manager approval is required.",
      sources: [{ id: "chunk-a", excerpt: "Manager approval is required.", pageStart: 2, pageEnd: 2, sectionHeading: "Leave" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<HomePage />);
    fireEvent.change(screen.getByLabelText("Message Untangle"), { target: { value: "Can I take leave?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(screen.getByText("Manager approval is required.")).toBeInTheDocument());
    expect(screen.getByText("SOURCES: Leave")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/policy-query", expect.objectContaining({
      body: JSON.stringify({ query: "Can I take leave?" }),
    }));
  });

  it("reports endpoint failures without displaying server details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "GROQ_PROVIDER_ERROR",
      answer: "Policy interpretation is temporarily unavailable. Please try again later.",
      sources: [],
    }), { status: 503, headers: { "content-type": "application/json" } }));
    render(<HomePage />);
    fireEvent.change(screen.getByLabelText("Message Untangle"), { target: { value: "Question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Policy search is temporarily unavailable"));
    expect(screen.queryByText(/GROQ_PROVIDER_ERROR/)).not.toBeInTheDocument();
  });
});
