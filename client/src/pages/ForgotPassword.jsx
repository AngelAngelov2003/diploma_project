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
      const text = data?.message || "If an account exists, a password reset link has been sent.";
      setMessage(text);
      notifySuccess(text);
    } catch (error) {
      const text = error?.response?.data?.error || "Could not send reset link.";
      setMessage(text);
      notifyError(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "clamp(16px, 4vw, 22px)", width: "min(440px, calc(100vw - 24px))", maxWidth: "440px", boxSizing: "border-box", margin: "clamp(18px, 8vw, 50px) auto", border: "1px solid #ddd", borderRadius: "16px" }}>
      <h2><FaEnvelope /> Reset password</h2>
      <p style={{ color: "#64748b" }}>Enter your email and we will send you a secure reset link.</p>
      {message ? <p style={{ color: "#2563eb" }}>{message}</p> : null}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} />
        <button type="submit" disabled={submitting} style={{ padding: "12px", width: "100%", borderRadius: "12px", background: submitting ? "#6c757d" : "#007bff", color: "white", border: "none" }}>{submitting ? "Sending..." : "Send reset link"}</button>
      </form>
      <div style={{ marginTop: "14px", textAlign: "center" }}><Link to="/login">Back to login</Link></div>
    </div>
  );
}
