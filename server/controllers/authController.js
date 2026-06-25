const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const { validateStrongPassword } = require("../utils/passwordValidation");
const billingService = require("../services/billingService");

const register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        error: `Паролата трябва да съдържа: ${passwordCheck.errors.join(", ")}.`,
      });
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(401).json("Потребителят вече съществува");
    }

    const bcryptPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role, is_verified, is_active)
        VALUES ($1, $2, $3, 'user', FALSE, TRUE)
        RETURNING id, full_name, email, role, is_verified, is_active, created_at, updated_at
      `,
      [full_name, email, bcryptPassword]
    );

    await pool.query(
      `
        INSERT INTO user_notification_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [newUser.rows[0].id]
    );

    try {
      await sendVerificationEmail(newUser.rows[0]);
    } catch (emailErr) {
      console.error("verification email error:", emailErr);
    }

    res.status(201).json({
      message: "Регистрацията е успешна. Изпратихме линк за потвърждение на имейла. Потвърдете профила, преди да влезете.",
      requires_email_verification: true,
      user: newUser.rows[0],
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json("Паролата или имейлът са неправилни");
    }

    if (user.rows[0].is_active === false) {
      return res.status(403).json({ error: "Вашият акаунт е неактивен" });
    }

    // Администраторските профили могат да влизат дори ако са създадени преди
    // въвеждането на email verification и нямат записан потвърден статус.
    if (user.rows[0].role !== "admin" && user.rows[0].is_verified !== true) {
      return res.status(403).json({
        error: "Профилът не е потвърден. Моля, отворете линка за потвърждение, изпратен на вашия имейл."
      });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json("Паролата или имейлът са неправилни");
    }

    const token = jwt.sign(
      { user_id: user.rows[0].id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        full_name: user.rows[0].full_name,
        email: user.rows[0].email,
        role: user.rows[0].role || "user",
        is_verified: user.rows[0].role === "admin" ? true : user.rows[0].is_verified,
        is_active: user.rows[0].is_active,
        created_at: user.rows[0].created_at,
        updated_at: user.rows[0].updated_at,
      },
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const me = async (req, res) => {
  try {
    const q = await pool.query(
      `
        SELECT id, full_name, email, role, is_verified, is_active, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [req.user]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Потребителят не е намерен" });
    }

    const billing = await billingService.getUserPremiumState(req.user, q.rows[0].role);
    res.json({ ...q.rows[0], billing });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно зареждане на текущия потребител" });
  }
};


const getClientBaseUrl = () => (
  process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000"
).replace(/\/$/, "");

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");


const sendVerificationEmail = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
    [user.id]
  );

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const verifyUrl = `${process.env.API_PUBLIC_URL || process.env.SERVER_URL || "http://localhost:5000"}/auth/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Потвърждение на имейл във Fishing Atlas",
    text: `Потвърдете имейл адреса си чрез този линк. Линкът изтича след 24 часа: ${verifyUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Потвърждение на имейл</h2>
        <p>Здравейте, ${user.full_name || "риболовец"},</p>
        <p>Натиснете бутона по-долу, за да потвърдите имейл адреса си във Fishing Atlas.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Потвърди имейла</a></p>
        <p>Линкът изтича след 24 часа. Ако не сте създавали акаунт, можете да игнорирате този имейл.</p>
      </div>
    `,
  });
};


const verifyEmail = async (req, res) => {
  const redirectBase = getClientBaseUrl();
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) {
      return res.redirect(`${redirectBase}/login?verified=missing`);
    }

    const tokenHash = hashResetToken(token);
    const tokenResult = await pool.query(
      `
        SELECT evt.id, evt.user_id, u.is_active
        FROM email_verification_tokens evt
        JOIN users u ON u.id = evt.user_id
        WHERE evt.token_hash = $1
          AND evt.used_at IS NULL
          AND evt.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );

    if (!tokenResult.rows.length || tokenResult.rows[0].is_active === false) {
      return res.redirect(`${redirectBase}/login?verified=invalid`);
    }

    const userId = tokenResult.rows[0].user_id;
    await pool.query("BEGIN");
    try {
      await pool.query("UPDATE users SET is_verified = TRUE, updated_at = NOW() WHERE id = $1", [userId]);
      await pool.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }

    return res.redirect(`${redirectBase}/login?verified=success`);
  } catch (err) {
    console.error("verifyEmail error:", err);
    return res.redirect(`${redirectBase}/login?verified=error`);
  }
};

const forgotPassword = async (req, res) => {
  const genericMessage = "Ако съществува акаунт, е изпратен линк за нулиране на паролата.";

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Имейлът е задължителен" });
    }

    const userResult = await pool.query(
      "SELECT id, email, full_name, is_active FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (!userResult.rows.length || userResult.rows[0].is_active === false) {
      return res.json({ message: genericMessage });
    }

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${getClientBaseUrl()}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Нулиране на паролата във Fishing Atlas",
      text: `Използвайте този линк, за да нулирате паролата си. Линкът изтича след 1 час: ${resetUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Нулиране на паролата</h2>
          <p>Здравейте, ${user.full_name || "риболовец"},</p>
          <p>Използвайте защитения линк по-долу, за да нулирате паролата си във Fishing Atlas. Линкът изтича след 1 час.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Нулирай паролата</a></p>
          <p>Ако не сте заявявали това действие, можете да игнорирате този имейл.</p>
        </div>
      `,
    });

    res.json({ message: genericMessage });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ error: "Неуспешно изпращане на имейл за нулиране" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) return res.status(400).json({ error: "Линкът за нулиране е задължителен" });

    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: `Паролата трябва да съдържа: ${passwordCheck.errors.join(", ")}.` });
    }

    const tokenHash = hashResetToken(token);
    const tokenResult = await pool.query(
      `
        SELECT prt.id, prt.user_id, u.is_active
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = $1
          AND prt.used_at IS NULL
          AND prt.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );

    if (!tokenResult.rows.length || tokenResult.rows[0].is_active === false) {
      return res.status(400).json({ error: "Линкът за нулиране е невалиден или изтекъл" });
    }

    const bcryptPassword = await bcrypt.hash(password, 10);
    const userId = tokenResult.rows[0].user_id;

    await pool.query("BEGIN");
    try {
      await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [bcryptPassword, userId]);
      await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }

    res.json({ message: "Паролата е променена успешно. Вече можете да влезете." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ error: "Неуспешно нулиране на паролата" });
  }
};

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  verifyEmail,
  resetPassword,
};