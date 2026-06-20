const { validateStrongPassword } = require("../utils/passwordValidation");

describe("Password validation", () => {
  test("accepts a strong Latin password", () => {
    const result = validateStrongPassword("StrongPass1!");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts a strong Cyrillic password", () => {
    const result = validateStrongPassword("СилнаПарола1!");
    expect(result.isValid).toBe(true);
  });

  test("rejects a short password", () => {
    const result = validateStrongPassword("A1!");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("at least 8 characters");
  });

  test("rejects a password without symbol", () => {
    const result = validateStrongPassword("StrongPass1");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("one symbol");
  });
});
