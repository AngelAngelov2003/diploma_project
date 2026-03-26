import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserPlus } from "react-icons/fa";
import { registerUser } from "../api/authApi";
import { notifyError, notifySuccess } from "../ui/toast";

const getErrorMessage = (error, fallbackMessage) => {
  const serverError = error?.response?.data?.error;
  const responseData = error?.response?.data;

  if (typeof serverError === "string" && serverError.trim()) {
    return serverError;
  }

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  return fallbackMessage;
};

function Register({ setAuth, setCurrentUser }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();

    setMessage("");
    setSubmitting(true);

    try {
      const data = await registerUser({
        full_name: fullName,
        email,
        password,
      });

      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || null);
      setAuth(true);

      const successMessage = "Registration successful";
      notifySuccess(successMessage);
      setMessage(successMessage);

      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Registration failed");
      notifyError(error, "Registration failed");
      setMessage(errorMessage);
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
        <FaUserPlus /> Register
      </h2>

      {message && (
        <p
          style={{
            color: message.toLowerCase().includes("successful")
              ? "green"
              : "red",
          }}
        >
          {message}
        </p>
      )}

      <form
        onSubmit={handleRegister}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          style={{ padding: "10px" }}
          autoComplete="name"
        />

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
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px",
            background: submitting ? "#6c757d" : "#28a745",
            color: "white",
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default Register;