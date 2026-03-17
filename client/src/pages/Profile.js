import React, { useEffect, useState } from "react";
import { FaUserCog, FaSave, FaLock, FaBell } from "react-icons/fa";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

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

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    role: "",
    is_verified: false,
    created_at: "",
  });

  const [preferences, setPreferences] = useState({
    email_alerts_enabled: true,
    default_notification_frequency: "daily",
    default_min_score: 0,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [profileRes, preferencesRes] = await Promise.all([
          api.get("/profile"),
          api.get("/profile/notification-preferences"),
        ]);

        setProfile(profileRes.data || {});
        setPreferences(
          preferencesRes.data || {
            email_alerts_enabled: true,
            default_notification_frequency: "daily",
            default_min_score: 0,
          }
        );
      } catch (err) {
        notifyError(err, "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();

    if (!String(profile.full_name || "").trim()) {
      notifyError(null, "Full name is required");
      return;
    }

    if (!String(profile.email || "").trim()) {
      notifyError(null, "Email is required");
      return;
    }

    try {
      setSavingProfile(true);
      const res = await api.patch("/profile", {
        full_name: String(profile.full_name || "").trim(),
        email: String(profile.email || "").trim(),
      });
      setProfile((prev) => ({ ...prev, ...(res.data || {}) }));
      notifySuccess("Profile updated");
    } catch (err) {
      notifyError(err, "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      notifyError(null, "All password fields are required");
      return;
    }

    if (passwordForm.new_password.length < 6) {
      notifyError(null, "New password must be at least 6 characters");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      notifyError(null, "New password and confirm password do not match");
      return;
    }

    try {
      setSavingPassword(true);
      await api.patch("/profile/password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      notifySuccess("Password changed successfully");
    } catch (err) {
      notifyError(err, "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const savePreferences = async (e) => {
    e.preventDefault();

    const score = Number(preferences.default_min_score || 0);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      notifyError(null, "Default minimum score must be between 0 and 100");
      return;
    }

    try {
      setSavingPreferences(true);
      const res = await api.patch("/profile/notification-preferences", {
        email_alerts_enabled: Boolean(preferences.email_alerts_enabled),
        default_notification_frequency: preferences.default_notification_frequency || "daily",
        default_min_score: score,
      });
      setPreferences(res.data || preferences);
      notifySuccess("Notification preferences updated");
    } catch (err) {
      notifyError(err, "Failed to update notification preferences");
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
            Manage your personal information, password, and notification preferences.
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>
              <FaUserCog />
              Profile information
            </h3>

            <form onSubmit={saveProfile}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Full name</div>
                  <input
                    type="text"
                    value={profile.full_name || ""}
                    onChange={(e) => setProfile((prev) => ({ ...prev, full_name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Email</div>
                  <input
                    type="email"
                    value={profile.email || ""}
                    onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Role</div>
                  <input type="text" value={profile.role || ""} disabled style={{ ...inputStyle, background: "#f8fafc" }} />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Verified</div>
                  <input
                    type="text"
                    value={profile.is_verified ? "Yes" : "No"}
                    disabled
                    style={{ ...inputStyle, background: "#f8fafc" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
                Member since: {profile.created_at ? new Date(profile.created_at).toLocaleString() : "Unknown"}
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
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

            <form onSubmit={savePassword}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Current password</div>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>New password</div>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Confirm new password</div>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
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

            <form onSubmit={savePreferences}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Email alerts enabled</div>
                  <select
                    value={preferences.email_alerts_enabled ? "true" : "false"}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        email_alerts_enabled: e.target.value === "true",
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Default frequency</div>
                  <select
                    value={preferences.default_notification_frequency || "daily"}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        default_notification_frequency: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Default minimum score</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number(preferences.default_min_score || 0)}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        default_min_score: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
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