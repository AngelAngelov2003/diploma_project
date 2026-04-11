import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import { loginUser } from "../api/authApi";
import { notifyError, notifySuccess } from "../ui/toast";

const getErrorMessage = (error, fallbackMessage) => {
  const serverError = error?.response?.data?.error;
  const responseMessage = error?.response?.data?.message;
  const responseData = error?.response?.data;

  if (typeof serverError === "string" && serverError.trim()) {
    return serverError;
  }

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

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

      const successMessage = "Login successful";
      notifySuccess(successMessage);
      setMessage(successMessage);

      setTimeout(() => {
        navigate("/");
      }, 700);
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

      {message && (
        <p
          style={{
            color: message.toLowerCase().includes("successful")
              ? "green"
              : "red",
            marginBottom: "12px",
          }}
        >
          {message}
        </p>
      )}

      <form
        onSubmit={handleLogin}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{ padding: "10px" }}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
}

export default Login;