import React, { useEffect, useState } from "react";
import { FaUserCog, FaSave, FaLock, FaBell } from "react-icons/fa";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  getNotificationPreferences,
  getProfile,
  updateNotificationPreferences,
  updatePassword,
  updateProfile,
} from "../api/profileApi";

const pageStyle = {
  padding: 20,
  background: "#f8fafc",
  minHeight: "calc(100vh - 60px)",
};

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  boxSizing: "border-box",
  background: "white",
};

const sectionTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  margin: "0 0 14px 0",
  fontSize: "18px",
  fontWeight: 800,
  color: "#0f172a",
};

const DEFAULT_PROFILE = {
  full_name: "",
  email: "",
  role: "",
  is_verified: false,
  created_at: "",
};

const DEFAULT_PREFERENCES = {
  email_alerts_enabled: true,
  default_notification_frequency: "daily",
  default_min_score: 0,
};

const DEFAULT_PASSWORD_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

function formatErrorMessage(error, fallback) {
  const serverError = error?.response?.data?.error;
  const responseData = error?.response?.data;

  if (typeof serverError === "string" && serverError.trim()) {
    return serverError;
  }

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  return fallback;
}

export default function Profile({ setCurrentUser }) {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [passwordForm, setPasswordForm] = useState(DEFAULT_PASSWORD_FORM);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);

        const [profileData, preferencesData] = await Promise.all([
          getProfile(),
          getNotificationPreferences(),
        ]);

        setProfile(profileData || DEFAULT_PROFILE);
        setCurrentUser(profileData || null);
        setPreferences(preferencesData || DEFAULT_PREFERENCES);
      } catch (error) {
        notifyError(error, formatErrorMessage(error, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [setCurrentUser]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    const fullName = String(profile.full_name || "").trim();
    const email = String(profile.email || "").trim();

    if (!fullName) {
      notifyError(null, "Full name is required");
      return;
    }

    if (!email) {
      notifyError(null, "Email is required");
      return;
    }

    try {
      setSavingProfile(true);

      const updatedProfile = await updateProfile({
        full_name: fullName,
        email,
      });

      setProfile((prev) => ({ ...prev, ...(updatedProfile || {}) }));
      setCurrentUser(updatedProfile || null);
      notifySuccess("Profile updated");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(error, "Failed to update profile"),
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    const { current_password, new_password, confirm_password } = passwordForm;

    if (!current_password || !new_password || !confirm_password) {
      notifyError(null, "All password fields are required");
      return;
    }

    if (new_password.length < 6) {
      notifyError(null, "New password must be at least 6 characters");
      return;
    }

    if (new_password !== confirm_password) {
      notifyError(null, "New password and confirm password do not match");
      return;
    }

    try {
      setSavingPassword(true);

      await updatePassword({
        current_password,
        new_password,
      });

      setPasswordForm(DEFAULT_PASSWORD_FORM);
      notifySuccess("Password changed successfully");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(error, "Failed to change password"),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePreferencesSubmit = async (event) => {
    event.preventDefault();

    const score = Number(preferences.default_min_score || 0);

    if (!Number.isInteger(score) || score < 0 || score > 100) {
      notifyError(null, "Default minimum score must be between 0 and 100");
      return;
    }

    try {
      setSavingPreferences(true);

      const updatedPreferences = await updateNotificationPreferences({
        email_alerts_enabled: Boolean(preferences.email_alerts_enabled),
        default_notification_frequency:
          preferences.default_notification_frequency || "daily",
        default_min_score: score,
      });

      setPreferences(updatedPreferences || preferences);
      notifySuccess("Notification preferences updated");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(
          error,
          "Failed to update notification preferences",
        ),
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading profile...</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Profile Settings</h2>
          <div style={{ opacity: 0.95, lineHeight: 1.6, fontSize: 14 }}>
            Manage your personal information, password, and notification
            preferences.
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>
              <FaUserCog />
              Profile information
            </h3>

            <form onSubmit={handleProfileSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Full name
                  </div>
                  <input
                    type="text"
                    value={profile.full_name || ""}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        full_name: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Email
                  </div>
                  <input
                    type="email"
                    value={profile.email || ""}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Role
                  </div>
                  <input
                    type="text"
                    value={profile.role || ""}
                    disabled
                    style={{ ...inputStyle, background: "#f8fafc" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Verified
                  </div>
                  <input
                    type="text"
                    value={profile.is_verified ? "Yes" : "No"}
                    disabled
                    style={{ ...inputStyle, background: "#f8fafc" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
                Member since:{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleString()
                  : "Unknown"}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{
                    background: "#0d6efd",
                    color: "white",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: savingProfile ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  <FaSave style={{ marginRight: 8 }} />
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>
              <FaLock />
              Change password
            </h3>

            <form onSubmit={handlePasswordSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Current password
                  </div>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        current_password: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    New password
                  </div>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        new_password: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Confirm new password
                  </div>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirm_password: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={savingPassword}
                  style={{
                    background: "#334155",
                    color: "white",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: savingPassword ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  <FaLock style={{ marginRight: 8 }} />
                  {savingPassword ? "Saving..." : "Change password"}
                </button>
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>
              <FaBell />
              Notification preferences
            </h3>

            <form onSubmit={handlePreferencesSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Email alerts enabled
                  </div>
                  <select
                    value={preferences.email_alerts_enabled ? "true" : "false"}
                    onChange={(event) =>
                      setPreferences((prev) => ({
                        ...prev,
                        email_alerts_enabled: event.target.value === "true",
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Default frequency
                  </div>
                  <select
                    value={
                      preferences.default_notification_frequency || "daily"
                    }
                    onChange={(event) =>
                      setPreferences((prev) => ({
                        ...prev,
                        default_notification_frequency: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Default minimum score
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number(preferences.default_min_score || 0)}
                    onChange={(event) =>
                      setPreferences((prev) => ({
                        ...prev,
                        default_min_score: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={savingPreferences}
                  style={{
                    background: "#16a34a",
                    color: "white",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: savingPreferences ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  <FaSave style={{ marginRight: 8 }} />
                  {savingPreferences ? "Saving..." : "Save preferences"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}