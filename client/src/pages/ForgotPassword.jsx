import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope } from "react-icons/fa";
import { requestPasswordReset } from "../api/authApi";
import { notifyError, notifySuccess } from "../ui/toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const data = await requestPasswordReset({ email });
      const text = data?.message || "Ако съществува акаунт, е изпратен линк за нулиране на паролата.";
      setMessage(text);
      notifySuccess(text);
    } catch (error) {
      const text = error?.response?.data?.error || "Линкът за нулиране не можа да бъде изпратен.";
      setMessage(text);
      notifyError(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "clamp(16px, 4vw, 22px)", width: "min(440px, calc(100vw - 24px))", maxWidth: "440px", boxSizing: "border-box", margin: "clamp(18px, 8vw, 50px) auto", border: "1px solid #ddd", borderRadius: "16px" }}>
      <h2><FaEnvelope /> Нулиране на парола</h2>
      <p style={{ color: "#64748b" }}>Въведете имейла си и ще получите защитен линк за възстановяване.</p>
      {message ? <p style={{ color: "#2563eb" }}>{message}</p> : null}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="email" placeholder="Имейл" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} />
        <button type="submit" disabled={submitting} style={{ padding: "12px", width: "100%", borderRadius: "12px", background: submitting ? "#6c757d" : "#007bff", color: "white", border: "none" }}>{submitting ? "Изпращане..." : "Изпрати линк за нулиране"}</button>
      </form>
      <div style={{ marginTop: "14px", textAlign: "center" }}><Link to="/login">Назад към вход</Link></div>
    </div>
  );
}
