import React, { useEffect, useMemo, useState } from "react";
import { FaUserShield } from "react-icons/fa";
import { notifyError, notifySuccess } from "../ui/toast";
import { getProfile } from "../api/profileApi";
import { getMyClaimRequests, submitClaimRequest } from "../api/ownerApi";
import { searchWaterBodies } from "../api/waterBodiesApi";
import styles from "./BecomeOwner.module.css";

const formatWaterTypeLabel = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (["reservoir", "dam", "язовир"].includes(raw)) return "Язовир";
  return "Езеро";
};

const DEFAULT_FORM = {
  lakeSearch: "",
  selectedLakeId: "",
  full_name: "",
  email: "",
  phone: "",
  company_name: "",
  message: "",
  proof_document: null,
};

const formatDateTime = (value) => {
  if (!value) return "Неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getStatusTone = (status) => {
  if (status === "approved") return { background: "#dcfce7", color: "#166534" };
  if (status === "rejected") return { background: "#fee2e2", color: "#991b1b" };
  return { background: "#fef3c7", color: "#92400e" };
};

export default function BecomeOwner() {
  const [claimForm, setClaimForm] = useState(DEFAULT_FORM);
  const [claimRequests, setClaimRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedLake = useMemo(
    () => searchResults.find((item) => String(item.id) === String(claimForm.selectedLakeId)),
    [searchResults, claimForm.selectedLakeId]
  );

  const loadPage = async () => {
    try {
      setLoading(true);
      const [profileRes, claimsRes] = await Promise.allSettled([
        getProfile(),
        getMyClaimRequests(),
      ]);

      const profile = profileRes.status === "fulfilled" ? profileRes.value : null;
      const myClaims = claimsRes.status === "fulfilled" ? claimsRes.value : [];

      setClaimRequests(myClaims);
      setClaimForm((prev) => ({
        ...prev,
        full_name: prev.full_name || profile?.full_name || "",
        email: prev.email || profile?.email || "",
      }));
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на страницата за заявка за собственик");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const query = claimForm.lakeSearch.trim();

    if (!query) {
      setSearchResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await searchWaterBodies(query);

        const normalizedResults = Array.isArray(results)
          ? results
              .filter((item) => item?.is_private)
              .slice(0, 8)
              .map((item) => ({
                ...item,
                canRequestOwnership: Boolean(
                  item?.is_private &&
                    !item?.owner_id
                ),
              }))
          : [];

        setSearchResults(normalizedResults);
      } catch (error) {
        notifyError(error, "Неуспешно търсене на водоеми");
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [claimForm.lakeSearch]);

  const handleSelectLake = (lake) => {
    if (!lake?.is_private) {
      notifyError(null, "Заявка може да се подаде само за частни водоеми");
      return;
    }


    if (lake?.owner_id) {
      notifyError(null, "Този водоем вече има собственик");
      return;
    }

    setClaimForm((prev) => ({
      ...prev,
      selectedLakeId: lake.id,
      lakeSearch: lake.name,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!claimForm.selectedLakeId) {
      notifyError(null, "Първо потърси и избери своя водоем");
      return;
    }

    if (!claimForm.full_name.trim()) {
      notifyError(null, "Име и фамилия е задължително");
      return;
    }

    if (!claimForm.email.trim()) {
      notifyError(null, "Имейлът е задължителен");
      return;
    }

    if (!claimForm.proof_document) {
      notifyError(null, "Моля, качи документ за доказателство");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("water_body_id", claimForm.selectedLakeId);
      formData.append("full_name", claimForm.full_name.trim());
      formData.append("email", claimForm.email.trim());
      formData.append("phone", claimForm.phone.trim());
      formData.append("company_name", claimForm.company_name.trim());
      formData.append("message", claimForm.message.trim());
      formData.append("proof_document", claimForm.proof_document);

      await submitClaimRequest(formData);

      notifySuccess("Заявката за собственик беше изпратена успешно");
      setClaimForm((prev) => ({
        ...DEFAULT_FORM,
        full_name: prev.full_name,
        email: prev.email,
      }));
      setSearchResults([]);
      await loadPage();
    } catch (error) {
      notifyError(error, "Неуспешно изпращане на заявката за собственик");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Зареждане на заявката за собственик...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            <FaUserShield />
            <span>Стани собственик</span>
          </div>
          <h2 className={styles.heroTitle}>Стани собственик</h2>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Форма за верификация на собственик</h3>
            <form onSubmit={handleSubmit} className={styles.formStack}>
              <div>
                <div className={styles.fieldLabel}>Търсене на вашия водоем</div>
                <input
                  className={styles.input}
                  type="text"
                  value={claimForm.lakeSearch}
                  placeholder="Започни да пишеш името на водоема"
                  onChange={(event) =>
                    setClaimForm((prev) => ({
                      ...prev,
                      lakeSearch: event.target.value,
                      selectedLakeId: "",
                    }))
                  }
                />
                <div className={styles.helperText}>
                  Потърсете съществуващия частен водоем, който притежавате или управлявате. Показват се само частни водоеми. Водоем може да бъде
                  избран, ако все още няма собственик. Резервациите могат да бъдат активирани по-късно от панела на собственика.
                </div>

                {searchLoading ? <div className={styles.helperText}>Търсене на водоеми...</div> : null}
                {!searchLoading && claimForm.lakeSearch.trim() && !searchResults.length ? (
                  <div className={styles.helperText}>Няма намерени частни водоеми.</div>
                ) : null}

                {!!searchResults.length && (
                  <div className={styles.resultsList}>
                    {searchResults.map((lake) => {
                      const active = String(lake.id) === String(claimForm.selectedLakeId);

                      return (
                        <button
                          key={lake.id}
                          type="button"
                          className={`${styles.resultButton} ${active ? styles.resultButtonActive : ""} ${
                            lake.canRequestOwnership ? "" : styles.resultButtonDisabled
                          }`}
                          onClick={() => handleSelectLake(lake)}
                        >
                          <span className={styles.resultTitle}>{lake.name}</span>
                          <span className={styles.resultMeta}>
                            {formatWaterTypeLabel(lake.type)}
                            {lake.is_private ? " · Частен" : " · Публичен"}
                            {lake.is_reservable ? " · Приема резервации" : " · Не приема резервации"}
                            {lake.owner_id ? " · Има собственик" : " · Без собственик"}
                            {lake.canRequestOwnership ? " · Подходящ" : " · Неподходящ"}
                          </span>

                          {!lake.canRequestOwnership ? (
                            <span className={styles.resultHint}>
                              {lake.owner_id
                                ? "Този водоем вече има собственик."
                                : !lake.is_private
                                ? "Заявка може да се подаде само за частен водоем."
                                : "За този водоем все още не може да се подаде заявка."}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedLake ? (
                  <div className={styles.selectedLakeBox}>
                    <div className={styles.selectedLakeTitle}>Избран водоем</div>
                    <div className={styles.selectedLakeName}>{selectedLake.name}</div>
                    <div className={styles.helperText}>{selectedLake.description || "Няма описание"}</div>
                  </div>
                ) : null}
              </div>

              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>Име и фамилия</div>
                  <input
                    className={styles.input}
                    type="text"
                    value={claimForm.full_name}
                    onChange={(event) =>
                      setClaimForm((prev) => ({ ...prev, full_name: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>Имейл</div>
                  <input
                    className={styles.input}
                    type="email"
                    value={claimForm.email}
                    onChange={(event) =>
                      setClaimForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>Телефон</div>
                  <input
                    className={styles.input}
                    type="text"
                    value={claimForm.phone}
                    onChange={(event) =>
                      setClaimForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <div className={styles.fieldLabel}>Име на фирма (по желание)</div>
                  <input
                    className={styles.input}
                    type="text"
                    value={claimForm.company_name}
                    onChange={(event) =>
                      setClaimForm((prev) => ({ ...prev, company_name: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <div className={styles.fieldLabel}>Съобщение до администратора (по желание)</div>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={claimForm.message}
                  onChange={(event) =>
                    setClaimForm((prev) => ({ ...prev, message: event.target.value }))
                  }
                  placeholder="Добавете детайли като тип собственост, договор за наем или друга информация, която помага при прегледа."
                />
              </div>

              <div>
                <div className={styles.fieldLabel}>Документ за доказване</div>
                <input
                  id="owner-proof-document"
                  style={{ display: "none" }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) =>
                    setClaimForm((prev) => ({
                      ...prev,
                      proof_document: event.target.files?.[0] || null,
                    }))
                  }
                />
                <label htmlFor="owner-proof-document" className={styles.secondaryButton}>Избери файл</label>
                <span className={styles.helperText} style={{ marginLeft: 10 }}>
                  {claimForm.proof_document?.name || "Няма избран файл"}
                </span>
                <div className={styles.helperText}>Позволени формати: PDF, PNG, JPG, JPEG.</div>
              </div>

              <div className={styles.actionRow}>
                <button className={styles.submitButton} type="submit" disabled={submitting}>
                  {submitting ? "Изпращане..." : "Изпрати заявка за собственик"}
                </button>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Моите заявки за собственик</h3>
            {!claimRequests.length ? (
              <div className={styles.emptyText}>Все още не сте изпратили заявки за собственост.</div>
            ) : (
              <div className={styles.requestList}>
                {claimRequests.map((item) => {
                  const tone = getStatusTone(item.status);
                  return (
                    <div key={item.id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <div>
                          <div className={styles.requestTitle}>{item.lake_name}</div>
                          <div className={styles.requestMeta}>Изпратена: {formatDateTime(item.created_at)}</div>
                        </div>
                        <span className={styles.statusBadge} style={tone}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className={styles.requestMeta}>Имейл за контакт: {item.email}</div>
                      {item.phone ? <div className={styles.requestMeta}>Телефон: {item.phone}</div> : null}
                      {item.company_name ? (
                        <div className={styles.requestMeta}>Фирма: {item.company_name}</div>
                      ) : null}
                      {item.message ? <div className={styles.requestNote}>Вашата бележка: {item.message}</div> : null}
                      {item.admin_note ? (
                        <div className={styles.requestNote}>Бележка от администратор: {item.admin_note}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}