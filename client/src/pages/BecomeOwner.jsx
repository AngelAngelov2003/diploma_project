import React, { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../ui/toast";
import { getProfile } from "../api/profileApi";
import { getMyClaimRequests, submitClaimRequest } from "../api/ownerApi";
import { searchWaterBodies } from "../api/waterBodiesApi";
import styles from "./BecomeOwner.module.css";

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
  if (!value) return "Unknown";
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
      notifyError(error, "Failed to load owner application page");
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
                    item?.is_reservable &&
                    !item?.owner_id
                ),
              }))
          : [];

        setSearchResults(normalizedResults);
      } catch (error) {
        notifyError(error, "Failed to search lakes");
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [claimForm.lakeSearch]);

  const handleSelectLake = (lake) => {
    if (!lake?.is_private) {
      notifyError(null, "Only private lakes can be requested");
      return;
    }

    if (!lake?.is_reservable) {
      notifyError(null, "This lake is not reservable yet");
      return;
    }

    if (lake?.owner_id) {
      notifyError(null, "This lake already has an owner");
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
      notifyError(null, "Please search for and select your lake first");
      return;
    }

    if (!claimForm.full_name.trim()) {
      notifyError(null, "Full name is required");
      return;
    }

    if (!claimForm.email.trim()) {
      notifyError(null, "Email is required");
      return;
    }

    if (!claimForm.proof_document) {
      notifyError(null, "Please upload a proof document");
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

      notifySuccess("Owner application submitted successfully");
      setClaimForm((prev) => ({
        ...DEFAULT_FORM,
        full_name: prev.full_name,
        email: prev.email,
      }));
      setSearchResults([]);
      await loadPage();
    } catch (error) {
      notifyError(error, "Failed to submit owner application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading owner application...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Become an Owner</h2>
          <div className={styles.heroText}>
            Submit proof that you own or manage a private reservable fishing lake. Your request stays available at all
            times, and an administrator will review it before owner access is enabled.
          </div>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Owner verification form</h3>
            <form onSubmit={handleSubmit} className={styles.formStack}>
              <div>
                <div className={styles.fieldLabel}>Search for your lake</div>
                <input
                  className={styles.input}
                  type="text"
                  value={claimForm.lakeSearch}
                  placeholder="Start typing the lake name"
                  onChange={(event) =>
                    setClaimForm((prev) => ({
                      ...prev,
                      lakeSearch: event.target.value,
                      selectedLakeId: "",
                    }))
                  }
                />
                <div className={styles.helperText}>
                  Search for the existing private lake you own or manage. Only private lakes are shown. A lake can be
                  selected only if it is reservable and does not already have an owner.
                </div>

                {searchLoading ? <div className={styles.helperText}>Searching lakes...</div> : null}
                {!searchLoading && claimForm.lakeSearch.trim() && !searchResults.length ? (
                  <div className={styles.helperText}>No private lakes matched your search.</div>
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
                            {lake.type || "No type"}
                            {lake.is_private ? " · Private" : " · Public"}
                            {lake.is_reservable ? " · Reservable" : " · Not reservable"}
                            {lake.owner_id ? " · Owned" : " · No owner"}
                            {lake.canRequestOwnership ? " · Eligible" : " · Not eligible"}
                          </span>

                          {!lake.canRequestOwnership ? (
                            <span className={styles.resultHint}>
                              {lake.owner_id
                                ? "This lake already has an owner."
                                : !lake.is_reservable
                                ? "This lake is not reservable yet."
                                : "This lake cannot be requested yet."}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedLake ? (
                  <div className={styles.selectedLakeBox}>
                    <div className={styles.selectedLakeTitle}>Selected lake</div>
                    <div className={styles.selectedLakeName}>{selectedLake.name}</div>
                    <div className={styles.helperText}>{selectedLake.description || "No description"}</div>
                  </div>
                ) : null}
              </div>

              <div className={styles.formGrid}>
                <div>
                  <div className={styles.fieldLabel}>Full name</div>
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
                  <div className={styles.fieldLabel}>Email</div>
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
                  <div className={styles.fieldLabel}>Phone</div>
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
                  <div className={styles.fieldLabel}>Company name (optional)</div>
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
                <div className={styles.fieldLabel}>Message for the admin (optional)</div>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={claimForm.message}
                  onChange={(event) =>
                    setClaimForm((prev) => ({ ...prev, message: event.target.value }))
                  }
                  placeholder="Add details such as ownership type, lease agreement, or anything that helps with review."
                />
              </div>

              <div>
                <div className={styles.fieldLabel}>Proof document</div>
                <input
                  className={styles.input}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) =>
                    setClaimForm((prev) => ({
                      ...prev,
                      proof_document: event.target.files?.[0] || null,
                    }))
                  }
                />
                <div className={styles.helperText}>Accepted formats: PDF, PNG, JPG, JPEG.</div>
              </div>

              <div className={styles.actionRow}>
                <button className={styles.submitButton} type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit owner application"}
                </button>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>My owner applications</h3>
            {!claimRequests.length ? (
              <div className={styles.emptyText}>You have not submitted any ownership applications yet.</div>
            ) : (
              <div className={styles.requestList}>
                {claimRequests.map((item) => {
                  const tone = getStatusTone(item.status);
                  return (
                    <div key={item.id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <div>
                          <div className={styles.requestTitle}>{item.lake_name}</div>
                          <div className={styles.requestMeta}>Submitted: {formatDateTime(item.created_at)}</div>
                        </div>
                        <span className={styles.statusBadge} style={tone}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className={styles.requestMeta}>Contact email: {item.email}</div>
                      {item.phone ? <div className={styles.requestMeta}>Phone: {item.phone}</div> : null}
                      {item.company_name ? (
                        <div className={styles.requestMeta}>Company: {item.company_name}</div>
                      ) : null}
                      {item.message ? <div className={styles.requestNote}>Your note: {item.message}</div> : null}
                      {item.admin_note ? (
                        <div className={styles.requestNote}>Admin note: {item.admin_note}</div>
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