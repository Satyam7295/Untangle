import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminLoginPage from "./page";

describe("Admin sign-in", () => {
  it("renders labeled credentials and validates empty submissions", async () => {
    render(<AdminLoginPage />);
    expect(screen.getByLabelText("Email or username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Enter your administrator ID and password.");
    });
  });
});
