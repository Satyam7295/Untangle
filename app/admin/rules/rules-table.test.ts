import { describe, expect, it } from "vitest";

import { getRuleEffectiveState } from "./rules-table";

const now = new Date("2026-02-01T12:00:00.000Z");

describe("business rule effective state", () => {
  it("distinguishes inactive, scheduled, active, and expired rules", () => {
    expect(getRuleEffectiveState({ isActive: false, effectiveFrom: null, effectiveUntil: null }, now)).toBe("inactive");
    expect(getRuleEffectiveState({ isActive: true, effectiveFrom: "2026-02-01T13:00:00.000Z", effectiveUntil: null }, now)).toBe("scheduled");
    expect(getRuleEffectiveState({ isActive: true, effectiveFrom: "2026-02-01T11:00:00.000Z", effectiveUntil: "2026-02-01T13:00:00.000Z" }, now)).toBe("active");
    expect(getRuleEffectiveState({ isActive: true, effectiveFrom: null, effectiveUntil: "2026-02-01T12:00:00.000Z" }, now)).toBe("expired");
  });
});
