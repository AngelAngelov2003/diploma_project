const toPasswordValue = (value) => String(value || "");

export const passwordRules = [
  {
    key: "length",
    label: "Поне 8 символа",
    test: (value) => toPasswordValue(value).length >= 8,
  },
  {
    key: "lower",
    label: "Една малка буква",
    test: (value) => /\p{Ll}/u.test(toPasswordValue(value)),
  },
  {
    key: "upper",
    label: "Една главна буква",
    test: (value) => /\p{Lu}/u.test(toPasswordValue(value)),
  },
  {
    key: "number",
    label: "Една цифра",
    test: (value) => /\p{N}/u.test(toPasswordValue(value)),
  },
  {
    key: "symbol",
    label: "Един символ",
    test: (value) => /[^\p{L}\p{N}]/u.test(toPasswordValue(value)),
  },
];

export const getPasswordStrength = (password) => {
  const passed = passwordRules.filter((rule) => rule.test(password));
  return { passed, isStrong: passed.length === passwordRules.length };
};
