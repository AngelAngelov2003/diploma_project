import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import { resetPassword } from "../api/authApi";
import { getPasswordStrength, passwordRules } from "../utils/passwordValidation";
import { notifyError, notifySuccess } from "../ui/toast";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!token) return setMessage("Липсва токен за нулиране на паролата.");
    if (!strength.isStrong) return setMessage("Моля, избери по-силна парола.");
    if (password !== confirmPassword) return setMessage("Паролите не съвпадат.");
    setSubmitting(true);
    try {
      const data = await resetPassword({ token, password });
      const text = data?.message || "Паролата е променена успешно.";
      notifySuccess(text);
      setMessage(text);
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      const text = error?.response?.data?.error || "Нулирането на паролата е неуспешно.";
      notifyError(text);
      setMessage(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "clamp(16px, 4vw, 22px)", width: "min(440px, calc(100vw - 24px))", maxWidth: "440px", boxSizing: "border-box", margin: "clamp(18px, 8vw, 50px) auto", border: "1px solid #ddd", borderRadius: "16px" }}>
      <h2><FaLock /> Нова парола</h2>
      {message ? <p style={{ color: message.toLowerCase().includes("успеш") ? "green" : "red" }}>{message}</p> : null}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="password" placeholder="Нова парола" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} autoComplete="new-password" />
        <input type="password" placeholder="Потвърди новата парола" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} autoComplete="new-password" />
        <div style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#475569" }}>
          {passwordRules.map((rule) => <span key={rule.key} style={{ color: rule.test(password) ? "#15803d" : "#64748b" }}>✓ {rule.label}</span>)}
        </div>
        <button type="submit" disabled={submitting} style={{ padding: "12px", width: "100%", borderRadius: "12px", background: submitting ? "#6c757d" : "#007bff", color: "white", border: "none" }}>{submitting ? "Запазване..." : "Нулирай паролата"}</button>
      </form>
      <div style={{ marginTop: "14px", textAlign: "center" }}><Link to="/login">Назад към вход</Link></div>
    </div>
  );
}
