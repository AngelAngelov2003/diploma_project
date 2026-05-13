const nodemailer = require("nodemailer");

let cachedTransporter = null;
let cachedTransportKey = "";

const getSmtpSummary = () => ({
  host: process.env.SMTP_HOST || null,
  port: process.env.SMTP_PORT || null,
  userConfigured: Boolean(process.env.SMTP_USER),
  passConfigured: Boolean(process.env.SMTP_PASS),
  fromConfigured: Boolean(process.env.EMAIL_FROM),
});

const ensureSmtpConfigured = () => {
  const missing = [
    ["SMTP_HOST", process.env.SMTP_HOST],
    ["SMTP_PORT", process.env.SMTP_PORT],
    ["SMTP_USER", process.env.SMTP_USER],
    ["SMTP_PASS", process.env.SMTP_PASS],
    ["EMAIL_FROM", process.env.EMAIL_FROM],
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Missing email environment variables: ${missing.join(", ")}`);
  }
};

const getTransportKey = () => [
  process.env.SMTP_HOST || "",
  process.env.SMTP_PORT || "",
  process.env.SMTP_USER || "",
].join("|");

const makeTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
};

const getTransporter = () => {
  ensureSmtpConfigured();

  const key = getTransportKey();
  if (!cachedTransporter || cachedTransportKey !== key) {
    cachedTransporter = makeTransporter();
    cachedTransportKey = key;
  }

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text: text || undefined,
    html,
  });

  return info;
};

module.exports = {
  makeTransporter,
  getTransporter,
  sendEmail,
  getSmtpSummary,
};
