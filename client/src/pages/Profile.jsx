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
import PageLoadingState from "../components/common/PageLoadingState";
import styles from "./Profile.module.css";

const DEFAULT_PROFILE = {
  full_name: "",
  email: "",
  role: "",
  is_verified: false,
  created_at: "",
};

const getRoleLabel = (role) => ({
  admin: "Администратор",
  owner: "Собственик",
  user: "Потребител",
}[role] || role || "Потребител");

const DEFAULT_PREFERENCES = {
  email_alerts_enabled: true,
  default_notification_frequency: "daily",
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
        notifyError(error, formatErrorMessage(error, "Неуспешно зареждане на профила"));
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
      notifyError(null, "Пълното име е задължително");
      return;
    }

    if (!email) {
      notifyError(null, "Имейлът е задължителен");
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
      notifySuccess("Профилът е обновен");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(error, "Неуспешно обновяване на профила"),
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    const { current_password, new_password, confirm_password } = passwordForm;

    if (!current_password || !new_password || !confirm_password) {
      notifyError(null, "Всички полета за парола са задължителни");
      return;
    }

    if (new_password.length < 6) {
      notifyError(null, "Новата парола трябва да е поне 6 символа");
      return;
    }

    if (new_password !== confirm_password) {
      notifyError(null, "Новата парола и потвърждението не съвпадат");
      return;
    }

    try {
      setSavingPassword(true);

      await updatePassword({
        current_password,
        new_password,
      });

      setPasswordForm(DEFAULT_PASSWORD_FORM);
      notifySuccess("Паролата е променена успешно");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(error, "Неуспешна промяна на паролата"),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePreferencesSubmit = async (event) => {
    event.preventDefault();

    try {
      setSavingPreferences(true);

      const updatedPreferences = await updateNotificationPreferences({
        email_alerts_enabled: Boolean(preferences.email_alerts_enabled),
        default_notification_frequency:
          preferences.default_notification_frequency || "daily",
      });

      setPreferences(updatedPreferences || preferences);
      notifySuccess("Настройките за известия са обновени");
    } catch (error) {
      notifyError(
        error,
        formatErrorMessage(
          error,
          "Неуспешно обновяване на настройките за известия",
        ),
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  if (loading) {
    return <PageLoadingState title="Зареждане на профил..." subtitle="Подготвяме личните данни, паролата и настройките за известия." cards={3} rows={2} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Настройки на профила</h2>
          <div className={styles.heroText}>
            Управлявайте личната си информация, паролата и настройките за известия.
          </div>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaUserCog />
              Информация за профила
            </h3>

            <form onSubmit={handleProfileSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
                    Име и фамилия
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
                    Имейл
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
                    Роля
                  </div>
                  <input
                    type="text"
                    value={getRoleLabel(profile.role)}
                    disabled
                    className={`${styles.input} ${styles.inputDisabled}`}
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>
                    Имейл потвърден
                  </div>
                  <input
                    type="text"
                    value={profile.is_verified ? "Да" : "Не"}
                    disabled
                    className={`${styles.input} ${styles.inputDisabled}`}
                  />
                </div>
              </div>

              <div className={styles.metaText} style={{ marginTop: 12 }}>
                Член от:{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleString()
                  : "Неизвестно"}
              </div>

              <div className={styles.actionRow}>
                <ActionButton
                  type="submit"
                  tone="primary"
                  disabled={savingProfile}
                >
                  <FaSave className="button-icon" style={{ marginRight: 8 }} />
                  {savingProfile ? "Запазване..." : "Запази профила"}
                </ActionButton>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaLock />
              Смяна на парола
            </h3>

            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
                    Текуща парола
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
                    Нова парола
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
                    Потвърди новата парола
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
                  {savingPassword ? "Запазване..." : "Смени паролата"}
                </ActionButton>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <FaBell />
              Настройки за известия
            </h3>

            <form onSubmit={handlePreferencesSubmit}>
              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>
                    Имейл известия
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
                    <option value="true">Включени</option>
                    <option value="false">Изключени</option>
                  </select>
                </div>

                <div>
                  <div className={styles.fieldLabel}>
                    Честота по подразбиране
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
                    <option value="daily">Дневно</option>
                    <option value="weekly">Седмично</option>
                  </select>
                </div>
              </div>

              <div className={styles.actionRow}>
                <ActionButton
                  type="submit"
                  tone="success"
                  disabled={savingPreferences}
                >
                  <FaSave className="button-icon" style={{ marginRight: 8 }} />
                  {savingPreferences ? "Запазване..." : "Запази настройките"}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}