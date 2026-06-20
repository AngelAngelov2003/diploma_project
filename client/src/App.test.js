import { formatCurrency } from "./utils/formatCurrency";
import { formatDateTime, toDateOnlyKey } from "./utils/date";
import { getPasswordStrength } from "./utils/passwordValidation";

describe("Client utility tests", () => {
  test("formats whole EUR prices", () => {
    expect(formatCurrency(120)).toContain("120");
    expect(formatCurrency(120)).toContain("€");
  });

  test("formats decimal EUR prices", () => {
    expect(formatCurrency(120.5)).toContain("120.50");
  });

  test("creates date-only key", () => {
    expect(toDateOnlyKey("2026-06-20T10:30:00")).toBe("2026-06-20");
  });

  test("returns placeholder for invalid date", () => {
    expect(formatDateTime("invalid-date")).toBe("—");
  });

  test("detects strong password", () => {
    expect(getPasswordStrength("StrongPass1!").isStrong).toBe(true);
  });
});
