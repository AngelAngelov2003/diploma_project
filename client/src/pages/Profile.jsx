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
import ActionButton from "../components/ui/ActionButton";
import styles from "./Profile.module.css";

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
    return <div className={styles.loading}>Loading profile...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Profile Settings</h2>
          <div className={styles.heroText}>
            Manage your personal information, password, and notification
            preferences.
          </div>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaUserCog />
              Profile information
            </h3>

            <form onSubmit={handleProfileSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
                    Role
                  </div>
                  <input
                    type="text"
                    value={profile.role || ""}
                    disabled
                    className={`${styles.input} ${styles.inputDisabled}`}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
                    Verified
                  </div>
                  <input
                    type="text"
                    value={profile.is_verified ? "Yes" : "No"}
                    disabled
                    className={`${styles.input} ${styles.inputDisabled}`}
                  />
                </div>
              </div>

              <div className={styles.metaText} style={{ marginTop: 12 }}>
                Member since:{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleString()
                  : "Unknown"}
              </div>

              <div className={styles.actionRow}>
                <ActionButton
                  type="submit"
                  tone="primary"
                  disabled={savingProfile}
                >
                  <FaSave className="button-icon" style={{ marginRight: 8 }} />
                  {savingProfile ? "Saving..." : "Save profile"}
                </ActionButton>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaLock />
              Change password
            </h3>

            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.actionRow}>
                <ActionButton
                  type="submit"
                  tone="neutral"
                  disabled={savingPassword}
                >
                  <FaLock className="button-icon" style={{ marginRight: 8 }} />
                  {savingPassword ? "Saving..." : "Change password"}
                </ActionButton>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaBell />
              Notification preferences
            </h3>

            <form onSubmit={handlePreferencesSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div className={styles.fieldLabel}>
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
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.actionRow}>
                <ActionButton
                  type="submit"
                  tone="success"
                  disabled={savingPreferences}
                >
                  <FaSave className="button-icon" style={{ marginRight: 8 }} />
                  {savingPreferences ? "Saving..." : "Save preferences"}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}