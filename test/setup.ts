import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/untangle";

afterEach(() => {
  cleanup();
});
