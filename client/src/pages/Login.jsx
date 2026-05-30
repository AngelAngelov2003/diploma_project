import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import { loginUser } from "../api/authApi";
import { notifyError, notifySuccess } from "../ui/toast";

const getErrorMessage = (error, fallbackMessage) => {
  const serverError = error?.response?.data?.error;
  const responseMessage = error?.response?.data?.message;
  const responseData = error?.response?.data;

  if (typeof serverError === "string" && serverError.trim()) return serverError;
  if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage;
  if (typeof responseData === "string" && responseData.trim()) return responseData;
  return fallbackMessage;
};

function Login({ setAuth, setCurrentUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setMessage("");
    setSubmitting(true);

    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || null);
      setAuth(true);
      notifySuccess("Login successful");
      setMessage("Login successful");
      setTimeout(() => navigate("/"), 700);
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Invalid credentials");
      setMessage(errorMessage);
      notifyError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: "clamp(16px, 4vw, 22px)",
        width: "min(400px, calc(100vw - 24px))",
        maxWidth: "400px",
        boxSizing: "border-box",
        margin: "clamp(18px, 8vw, 50px) auto",
        border: "1px solid #ddd",
        borderRadius: "16px",
      }}
    >
      <h2><FaLock /> Login</h2>
      {message && <p style={{ color: message.toLowerCase().includes("successful") ? "green" : "red", marginBottom: "12px" }}>{message}</p>}
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required style={{ padding: "12px", width: "100%", boxSizing: "border-box", fontSize: "16px" }} autoComplete="current-password" />
        <button type="submit" disabled={submitting} style={{ padding: "12px", width: "100%", borderRadius: "12px", background: submitting ? "#6c757d" : "#007bff", color: "white", border: "none", cursor: submitting ? "not-allowed" : "pointer" }}>{submitting ? "Signing in..." : "Sign In"}</button>
      </form>
      <div style={{ marginTop: "14px", textAlign: "center" }}>
        <Link to="/forgot-password" style={{ color: "#2563eb", fontWeight: 700 }}>Forgot password?</Link>
      </div>
    </div>
  );
}

export default Login;
