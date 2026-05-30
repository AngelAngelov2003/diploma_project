const validateStrongPassword = (password) => {
  const value = String(password || "");
  const errors = [];

  if (value.length < 8) errors.push("at least 8 characters");
  if (!/\p{Ll}/u.test(value)) errors.push("one lowercase letter");
  if (!/\p{Lu}/u.test(value)) errors.push("one uppercase letter");
  if (!/\p{N}/u.test(value)) errors.push("one number");
  if (!/[^\p{L}\p{N}]/u.test(value)) errors.push("one symbol");

  return { isValid: errors.length === 0, errors };
};

module.exports = { validateStrongPassword };
