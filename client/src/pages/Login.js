import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

const Login = ({ setAuth }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      setAuth(true);
      notifySuccess("Login successful");
      setMessage("Login successful");
      setTimeout(() => navigate("/"), 700);
    } catch (err) {
      notifyError(err, "Invalid credentials");
      const msg = err.response?.data?.error || err.response?.data || "Invalid credentials";
      setMessage(typeof msg === "string" ? msg : "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "400px",
        margin: "50px auto",
        border: "1px solid #ddd",
        borderRadius: "8px",
      }}
    >
      <h2>
        <FaLock /> Login
      </h2>

      {message && <p style={{ color: message.toLowerCase().includes("successful") ? "green" : "red" }}>{message}</p>}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px" }}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "10px" }}
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px",
            background: submitting ? "#6c757d" : "#007bff",
            color: "white",
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};

export default Login;