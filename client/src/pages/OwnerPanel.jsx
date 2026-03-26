import React, { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../ui/toast";
import { getProfile } from "../api/profileApi";
import {
  addBlockedDate,
  deleteBlockedDate,
  getBlockedDates,
  getClaimableLakes,
  getMyClaimRequests,
  getOwnerLakes,
  submitClaimRequest,
  updateOwnerLake,
} from "../api/ownerApi";

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

const DEFAULT_CLAIM_FORM = {
  full_name: "",
  email: "",
  phone: "",
  company_name: "",
  message: "",
  proof_document: null,
};

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const statusBadgeStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background:
    status === "approved"
      ? "#dcfce7"
      : status === "rejected"
        ? "#fee2e2"
        : "#fef3c7",
  color:
    status === "approved"
      ? "#166534"
      : status === "rejected"
        ? "#991b1b"
        : "#92400e",
});

const normalizeLakePayload = (lake) => ({
  name: lake.name,
  description: lake.description || "",
  type: lake.type || "",
  is_private: Boolean(lake.is_private),
  price_per_day: Number(lake.price_per_day || 0),
  capacity: Number(lake.capacity || 1),
  is_reservable: Boolean(lake.is_reservable),
  availability_notes: lake.availability_notes || "",
});

export default function OwnerPanel() {
  const [lakes, setLakes] = useState([]);
  const [claimableLakes, setClaimableLakes] = useState([]);
  const [myClaimRequests, setMyClaimRequests] = useState([]);
  const [blockedDatesByLake, setBlockedDatesByLake] = useState({});
  const [blockedDateInputs, setBlockedDateInputs] = useState({});
  const [blockedReasonInputs, setBlockedReasonInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [claimingId, setClaimingId] = useState("");
  const [blockingLakeId, setBlockingLakeId] = useState("");
  const [claimFormLakeId, setClaimFormLakeId] = useState("");
  const [claimForm, setClaimForm] = useState(DEFAULT_CLAIM_FORM);

  const loadOwnerPanel = async () => {
    try {
      setLoading(true);

      const [ownedRes, claimableRes, myClaimsRes, profileRes] =
        await Promise.allSettled([
          getOwnerLakes(),
          getClaimableLakes(),
          getMyClaimRequests(),
          getProfile(),
        ]);

      const owned = ownedRes.status === "fulfilled" ? ownedRes.value : [];
      const claimable =
        claimableRes.status === "fulfilled" ? claimableRes.value : [];
      const myClaims =
        myClaimsRes.status === "fulfilled" ? myClaimsRes.value : [];
      const profile =
        profileRes.status === "fulfilled" ? profileRes.value : null;

      setLakes(owned);
      setClaimableLakes(claimable);
      setMyClaimRequests(myClaims);

      setClaimForm((prev) => ({
        ...prev,
        full_name: prev.full_name || profile?.full_name || "",
        email: prev.email || profile?.email || "",
      }));

      const blockedEntries = await Promise.all(
        owned.map(async (lake) => {
          try {
            const blockedDates = await getBlockedDates(lake.id);
            return [lake.id, blockedDates || []];
          } catch {
            return [lake.id, []];
          }
        }),
      );

      setBlockedDatesByLake(Object.fromEntries(blockedEntries));
    } catch (error) {
      notifyError(error, "Failed to load owner panel");
      setLakes([]);
      setClaimableLakes([]);
      setMyClaimRequests([]);
      setBlockedDatesByLake({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerPanel();
  }, []);

  const updateLocalLake = (lakeId, field, value) => {
    setLakes((prev) =>
      prev.map((lake) =>
        lake.id === lakeId ? { ...lake, [field]: value } : lake,
      ),
    );
  };

  const handleSaveLake = async (lake) => {
    try {
      setSavingId(lake.id);

      const updatedLake = await updateOwnerLake(
        lake.id,
        normalizeLakePayload(lake),
      );

      setLakes((prev) =>
        prev.map((item) =>
          item.id === lake.id ? { ...item, ...updatedLake } : item,
        ),
      );

      notifySuccess("Lake settings updated");
    } catch (error) {
      notifyError(error, "Failed to update lake settings");
    } finally {
      setSavingId("");
    }
  };

  const openClaimForm = (lakeId) => {
    setClaimFormLakeId(lakeId);
    setClaimForm((prev) => ({
      ...prev,
      phone: "",
      company_name: "",
      message: "",
      proof_document: null,
    }));
  };

  const closeClaimForm = () => {
    setClaimFormLakeId("");
    setClaimForm((prev) => ({
      ...prev,
      phone: "",
      company_name: "",
      message: "",
      proof_document: null,
    }));
  };

  const handleSubmitClaimRequest = async (lakeId) => {
    try {
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

      setClaimingId(lakeId);

      const formData = new FormData();
      formData.append("water_body_id", lakeId);
      formData.append("full_name", claimForm.full_name.trim());
      formData.append("email", claimForm.email.trim());
      formData.append("phone", claimForm.phone.trim());
      formData.append("company_name", claimForm.company_name.trim());
      formData.append("message", claimForm.message.trim());
      formData.append("proof_document", claimForm.proof_document);

      await submitClaimRequest(formData);

      notifySuccess("Ownership verification request submitted");
      closeClaimForm();
      await loadOwnerPanel();
    } catch (error) {
      notifyError(error, "Failed to submit ownership request");
    } finally {
      setClaimingId("");
    }
  };

  const handleAddBlockedDate = async (lakeId) => {
    const blocked_date = blockedDateInputs[lakeId] || "";
    const reason = blockedReasonInputs[lakeId] || "";

    if (!blocked_date) {
      notifyError(null, "Choose a date first");
      return;
    }

    try {
      setBlockingLakeId(lakeId);

      const savedBlockedDate = await addBlockedDate(lakeId, {
        blocked_date,
        reason,
      });

      setBlockedDatesByLake((prev) => {
        const current = prev[lakeId] || [];
        const exists = current.some(
          (item) =>
            item.id === savedBlockedDate.id ||
            item.blocked_date === savedBlockedDate.blocked_date,
        );

        const next = exists
          ? current.map((item) =>
              item.blocked_date === savedBlockedDate.blocked_date
                ? savedBlockedDate
                : item,
            )
          : [...current, savedBlockedDate].sort((a, b) =>
              String(a.blocked_date).localeCompare(String(b.blocked_date)),
            );

        return { ...prev, [lakeId]: next };
      });

      setBlockedDateInputs((prev) => ({ ...prev, [lakeId]: "" }));
      setBlockedReasonInputs((prev) => ({ ...prev, [lakeId]: "" }));

      notifySuccess("Blocked date saved");
    } catch (error) {
      notifyError(error, "Failed to save blocked date");
    } finally {
      setBlockingLakeId("");
    }
  };

  const handleDeleteBlockedDate = async (lakeId, blockedDateId) => {
    try {
      setBlockingLakeId(lakeId);

      await deleteBlockedDate(lakeId, blockedDateId);

      setBlockedDatesByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter(
          (item) => item.id !== blockedDateId,
        ),
      }));

      notifySuccess("Blocked date removed");
    } catch (error) {
      notifyError(error, "Failed to delete blocked date");
    } finally {
      setBlockingLakeId("");
    }
  };

  const getLakeRequest = (lakeId) => {
    return myClaimRequests.find(
      (request) => String(request.water_body_id) === String(lakeId),
    );
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading owner panel...</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Owner Panel</h2>
          <div style={{ opacity: 0.95, lineHeight: 1.6, fontSize: 14 }}>
            Manage your private reservoirs, blocked dates, pricing, capacity,
            and reservation availability.
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>
              Request ownership verification
            </h3>

            {!claimableLakes.length ? (
              <div style={{ color: "#64748b" }}>
                No unowned private lakes are available to request.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {claimableLakes.map((lake) => {
                  const existingRequest = getLakeRequest(lake.id);

                  return (
                    <div
                      key={lake.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                        display: "grid",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {lake.name}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 6,
                            }}
                          >
                            {lake.type || "No type"} · Private lake
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#475569",
                              marginTop: 8,
                            }}
                          >
                            {lake.description || "No description"}
                          </div>
                        </div>

                        {existingRequest ? (
                          <div style={statusBadgeStyle(existingRequest.status)}>
                            {existingRequest.status.toUpperCase()}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openClaimForm(lake.id)}
                            style={{
                              background: "#16a34a",
                              color: "white",
                              border: "none",
                              padding: "10px 14px",
                              borderRadius: 10,
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Request verification
                          </button>
                        )}
                      </div>

                      {existingRequest && (
                        <div
                          style={{
                            borderTop: "1px solid #e5e7eb",
                            paddingTop: 12,
                            display: "grid",
                            gap: 6,
                            fontSize: 13,
                            color: "#475569",
                          }}
                        >
                          <div>
                            Submitted:{" "}
                            {formatDateTime(existingRequest.created_at)}
                          </div>
                          {existingRequest.admin_note ? (
                            <div>Admin note: {existingRequest.admin_note}</div>
                          ) : null}
                        </div>
                      )}

                      {claimFormLakeId === lake.id && !existingRequest && (
                        <div
                          style={{
                            borderTop: "1px solid #e5e7eb",
                            paddingTop: 14,
                            display: "grid",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              color: "#475569",
                              lineHeight: 1.6,
                            }}
                          >
                            Upload proof of ownership or management rights. Your
                            request will be reviewed by an administrator.
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(240px, 1fr))",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#555",
                                  marginBottom: 6,
                                }}
                              >
                                Full name
                              </div>
                              <input
                                type="text"
                                value={claimForm.full_name}
                                onChange={(event) =>
                                  setClaimForm((prev) => ({
                                    ...prev,
                                    full_name: event.target.value,
                                  }))
                                }
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#555",
                                  marginBottom: 6,
                                }}
                              >
                                Email
                              </div>
                              <input
                                type="email"
                                value={claimForm.email}
                                onChange={(event) =>
                                  setClaimForm((prev) => ({
                                    ...prev,
                                    email: event.target.value,
                                  }))
                                }
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#555",
                                  marginBottom: 6,
                                }}
                              >
                                Phone
                              </div>
                              <input
                                type="text"
                                value={claimForm.phone}
                                onChange={(event) =>
                                  setClaimForm((prev) => ({
                                    ...prev,
                                    phone: event.target.value,
                                  }))
                                }
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#555",
                                  marginBottom: 6,
                                }}
                              >
                                Company name
                              </div>
                              <input
                                type="text"
                                value={claimForm.company_name}
                                onChange={(event) =>
                                  setClaimForm((prev) => ({
                                    ...prev,
                                    company_name: event.target.value,
                                  }))
                                }
                                style={inputStyle}
                              />
                            </div>
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#555",
                                marginBottom: 6,
                              }}
                            >
                              Message
                            </div>
                            <textarea
                              rows={3}
                              value={claimForm.message}
                              onChange={(event) =>
                                setClaimForm((prev) => ({
                                  ...prev,
                                  message: event.target.value,
                                }))
                              }
                              style={{
                                ...inputStyle,
                                resize: "vertical",
                              }}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#555",
                                marginBottom: 6,
                              }}
                            >
                              Proof document
                            </div>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp"
                              onChange={(event) =>
                                setClaimForm((prev) => ({
                                  ...prev,
                                  proof_document:
                                    event.target.files?.[0] || null,
                                }))
                              }
                              style={inputStyle}
                            />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              disabled={claimingId === lake.id}
                              onClick={() => handleSubmitClaimRequest(lake.id)}
                              style={{
                                background: "#0d6efd",
                                color: "white",
                                border: "none",
                                padding: "10px 14px",
                                borderRadius: 10,
                                cursor:
                                  claimingId === lake.id
                                    ? "not-allowed"
                                    : "pointer",
                                fontWeight: 700,
                              }}
                            >
                              {claimingId === lake.id
                                ? "Submitting..."
                                : "Submit request"}
                            </button>

                            <button
                              type="button"
                              onClick={closeClaimForm}
                              style={{
                                background: "#334155",
                                color: "white",
                                border: "none",
                                padding: "10px 14px",
                                borderRadius: 10,
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!lakes.length ? (
            <div style={cardStyle}>You do not own any lakes yet.</div>
          ) : (
            lakes.map((lake) => {
              const busy = savingId === lake.id;
              const blocked = blockedDatesByLake[lake.id] || [];

              return (
                <div key={lake.id} style={cardStyle}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Lake name
                      </div>
                      <input
                        type="text"
                        value={lake.name || ""}
                        onChange={(event) =>
                          updateLocalLake(lake.id, "name", event.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Type
                      </div>
                      <input
                        type="text"
                        value={lake.type || ""}
                        onChange={(event) =>
                          updateLocalLake(lake.id, "type", event.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Price per day
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={Number(lake.price_per_day || 0)}
                        onChange={(event) =>
                          updateLocalLake(
                            lake.id,
                            "price_per_day",
                            event.target.value,
                          )
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Capacity
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={Number(lake.capacity || 1)}
                        onChange={(event) =>
                          updateLocalLake(
                            lake.id,
                            "capacity",
                            event.target.value,
                          )
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Private lake
                      </div>
                      <select
                        value={lake.is_private ? "true" : "false"}
                        onChange={(event) =>
                          updateLocalLake(
                            lake.id,
                            "is_private",
                            event.target.value === "true",
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="true">Private</option>
                        <option value="false">Public</option>
                      </select>
                    </div>

                    <div>
                      <div
                        style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                      >
                        Reservations
                      </div>
                      <select
                        value={lake.is_reservable ? "true" : "false"}
                        onChange={(event) =>
                          updateLocalLake(
                            lake.id,
                            "is_reservable",
                            event.target.value === "true",
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                    >
                      Description
                    </div>
                    <textarea
                      rows={3}
                      value={lake.description || ""}
                      onChange={(event) =>
                        updateLocalLake(
                          lake.id,
                          "description",
                          event.target.value,
                        )
                      }
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{ fontSize: 12, color: "#555", marginBottom: 6 }}
                    >
                      Availability notes
                    </div>
                    <textarea
                      rows={3}
                      value={lake.availability_notes || ""}
                      onChange={(event) =>
                        updateLocalLake(
                          lake.id,
                          "availability_notes",
                          event.target.value,
                        )
                      }
                      placeholder="Example: Closed on Mondays, open from sunrise to sunset."
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveLake(lake)}
                      style={{
                        background: "#0d6efd",
                        color: "white",
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {busy ? "Saving..." : "Save changes"}
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 16,
                    }}
                  >
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                      Blocked dates
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#555",
                            marginBottom: 6,
                          }}
                        >
                          Date
                        </div>
                        <input
                          type="date"
                          value={blockedDateInputs[lake.id] || ""}
                          onChange={(event) =>
                            setBlockedDateInputs((prev) => ({
                              ...prev,
                              [lake.id]: event.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#555",
                            marginBottom: 6,
                          }}
                        >
                          Reason
                        </div>
                        <input
                          type="text"
                          value={blockedReasonInputs[lake.id] || ""}
                          onChange={(event) =>
                            setBlockedReasonInputs((prev) => ({
                              ...prev,
                              [lake.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional reason"
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          disabled={blockingLakeId === lake.id}
                          onClick={() => handleAddBlockedDate(lake.id)}
                          style={{
                            width: "100%",
                            background: "#334155",
                            color: "white",
                            border: "none",
                            padding: "10px 14px",
                            borderRadius: 10,
                            cursor:
                              blockingLakeId === lake.id
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {blockingLakeId === lake.id
                            ? "Saving..."
                            : "Add blocked date"}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                      {!blocked.length ? (
                        <div style={{ color: "#64748b" }}>
                          No blocked dates yet.
                        </div>
                      ) : (
                        blocked.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: "#0f172a",
                                }}
                              >
                                {formatDate(item.blocked_date)}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#64748b",
                                  marginTop: 4,
                                }}
                              >
                                {item.reason || "No reason"}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={blockingLakeId === lake.id}
                              onClick={() =>
                                handleDeleteBlockedDate(lake.id, item.id)
                              }
                              style={{
                                background: "#dc2626",
                                color: "white",
                                border: "none",
                                padding: "8px 12px",
                                borderRadius: 10,
                                cursor:
                                  blockingLakeId === lake.id
                                    ? "not-allowed"
                                    : "pointer",
                                fontWeight: 700,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
