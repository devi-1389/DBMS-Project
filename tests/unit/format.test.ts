import { describe, expect, it } from "vitest";

import { RESORT } from "@/lib/config";
import {
  dateKeyToIso,
  formatAmount,
  formatPrice,
  formatTime,
  resortDayWindow,
  resortTime,
  timeOfDay,
  toDateKey,
} from "@/lib/format";

describe("SOLACE resort locale", () => {
  it("is India: rupees and India Standard Time", () => {
    expect(RESORT).toMatchObject({ name: "SOLACE", currency: "INR", timeZone: "Asia/Kolkata", locale: "en-IN" });
  });

  it("formats rupees with Indian digit grouping", () => {
    expect(formatPrice(1_500_000)).toBe("₹15,000");
    expect(formatPrice(10_000_000)).toBe("₹1,00,000");
    expect(formatPrice(0)).toBe("Complimentary");
    // Totals and budgets show zero as money, not "Complimentary".
    expect(formatAmount(0)).toBe("₹0");
    expect(formatAmount(1_500_000)).toBe("₹15,000");
  });
});

describe("resort time", () => {
  it("converts resort-local times to UTC (IST is UTC+05:30)", () => {
    expect(resortTime("2026-11-03", "07:00").toISOString()).toBe("2026-11-03T01:30:00.000Z");
    expect(resortTime("2026-11-03").toISOString()).toBe("2026-11-02T18:30:00.000Z");
  });

  it("reads dates and times back in resort time, even across UTC midnight", () => {
    const lateEvening = resortTime("2026-11-03", "23:30").toISOString(); // 18:00 UTC
    const earlyMorning = resortTime("2026-11-04", "04:00").toISOString(); // 22:30 UTC on the 3rd
    expect(toDateKey(lateEvening)).toBe("2026-11-03");
    expect(toDateKey(earlyMorning)).toBe("2026-11-04");
    expect(formatTime(resortTime("2026-11-03", "07:00").toISOString())).toBe("7:00 am");
    expect(timeOfDay(resortTime("2026-11-03", "07:00").toISOString())).toBe("morning");
    expect(timeOfDay(resortTime("2026-11-03", "19:00").toISOString())).toBe("evening");
  });

  it("builds half-open windows of whole resort days", () => {
    const window = resortDayWindow("2026-11-02", "2026-11-04");
    expect(window.from.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(window.to.toISOString()).toBe("2026-11-04T18:30:00.000Z");
    expect(toDateKey(dateKeyToIso("2026-11-02"))).toBe("2026-11-02");
  });
});
