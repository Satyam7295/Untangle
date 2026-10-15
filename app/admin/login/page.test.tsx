import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminLoginPage from "./page";

describe("Admin sign-in", () => {
  it("renders labeled credentials and generic pending authentication feedback", () => {
    render(<AdminLoginPage />);
    expect(screen.getByLabelText("Email or username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("authentication is not connected yet");
  });
});
