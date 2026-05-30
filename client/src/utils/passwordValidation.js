const toPasswordValue = (value) => String(value || "");

export const passwordRules = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => toPasswordValue(value).length >= 8,
  },
  {
    key: "lower",
    label: "One lowercase letter",
    test: (value) => /\p{Ll}/u.test(toPasswordValue(value)),
  },
  {
    key: "upper",
    label: "One uppercase letter",
    test: (value) => /\p{Lu}/u.test(toPasswordValue(value)),
  },
  {
    key: "number",
    label: "One number",
    test: (value) => /\p{N}/u.test(toPasswordValue(value)),
  },
  {
    key: "symbol",
    label: "One symbol",
    test: (value) => /[^\p{L}\p{N}]/u.test(toPasswordValue(value)),
  },
];

export const getPasswordStrength = (password) => {
  const passed = passwordRules.filter((rule) => rule.test(password));
  return { passed, isStrong: passed.length === passwordRules.length };
};
