import React, { useEffect, useState } from "react";
import { addBlockedDate, deleteBlockedDate, getBlockedDates, getOwnerLakes, updateOwnerLake } from "../api/ownerApi";
import { notifyError, notifySuccess } from "../ui/toast";
import { formatCurrency } from "../utils/formatCurrency";
import styles from "./OwnerPanel.module.css";

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

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function OwnerPanel() {
  const [lakes, setLakes] = useState([]);
  const [blockedDatesByLake, setBlockedDatesByLake] = useState({});
  const [blockedDateInputs, setBlockedDateInputs] = useState({});
  const [blockedReasonInputs, setBlockedReasonInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [blockingLakeId, setBlockingLakeId] = useState("");

  const loadOwnerPanel = async () => {
    try {
      setLoading(true);
      const owned = await getOwnerLakes();
      setLakes(Array.isArray(owned) ? owned : []);

      const blockedEntries = await Promise.all(
        (owned || []).map(async (lake) => {
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
      notifyError(error, "Failed to load owner lakes");
      setLakes([]);
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
      prev.map((lake) => (lake.id === lakeId ? { ...lake, [field]: value } : lake)),
    );
  };

  const handleSaveLake = async (lake) => {
    try {
      setSavingId(lake.id);
      const updatedLake = await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      setLakes((prev) => prev.map((item) => (item.id === lake.id ? { ...item, ...updatedLake } : item)));
      notifySuccess("Lake settings updated");
    } catch (error) {
      notifyError(error, "Failed to update lake settings");
    } finally {
      setSavingId("");
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
      const savedBlockedDate = await addBlockedDate(lakeId, { blocked_date, reason });

      setBlockedDatesByLake((prev) => {
        const current = prev[lakeId] || [];
        const exists = current.some(
          (item) =>
            item.id === savedBlockedDate.id || item.blocked_date === savedBlockedDate.blocked_date,
        );

        const next = exists
          ? current.map((item) =>
              item.blocked_date === savedBlockedDate.blocked_date ? savedBlockedDate : item,
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
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== blockedDateId),
      }));
      notifySuccess("Blocked date removed");
    } catch (error) {
      notifyError(error, "Failed to delete blocked date");
    } finally {
      setBlockingLakeId("");
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading owner panel...</div>;
  }

const totalEstimatedRevenue = lakes.reduce(
  (sum, lake) => sum + Number(lake.price_per_day || 0),
  0,
);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Owner Panel</h2>
          <div className={styles.heroText}>
            This page is now focused only on owner management. Review your approved lakes, update their
            details, and control blocked reservation dates.
          </div>
        </div>

        <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Owner summary</h3>
            <div className={styles.metaText}>Estimated daily revenue across your reservable lakes: {formatCurrency(totalEstimatedRevenue)}</div>
          </div>

        {!lakes.length ? (
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>No approved lakes yet</h3>
            <div className={styles.emptyState}>
              When an administrator approves your ownership request, your lakes will appear here.
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            {lakes.map((lake) => (
              <div key={lake.id} className={styles.card}>
                <div className={styles.sectionHeaderRow}>
                  <div>
                    <h3 className={styles.sectionTitle}>{lake.name}</h3>
                    <div className={styles.metaText}>
                      {lake.type || "No type"} · {lake.is_private ? "Private" : "Public"} · {formatCurrency(lake.price_per_day || 0)} per day
                    </div>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div>
                    <div className={styles.fieldLabel}>Lake name</div>
                    <input
                      className={styles.input}
                      type="text"
                      value={lake.name || ""}
                      onChange={(event) => updateLocalLake(lake.id, "name", event.target.value)}
                    />
                  </div>

                  <div>
                    <div className={styles.fieldLabel}>Type</div>
                    <input
                      className={styles.input}
                      type="text"
                      value={lake.type || ""}
                      onChange={(event) => updateLocalLake(lake.id, "type", event.target.value)}
                    />
                  </div>

                  <div>
                    <div className={styles.fieldLabel}>Price per day (€)</div>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={lake.price_per_day ?? 0}
                      onChange={(event) => updateLocalLake(lake.id, "price_per_day", event.target.value)}
                    />
                  </div>

                  <div>
                    <div className={styles.fieldLabel}>Capacity</div>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      step="1"
                      value={lake.capacity ?? 1}
                      onChange={(event) => updateLocalLake(lake.id, "capacity", event.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={Boolean(lake.is_private)}
                      onChange={(event) => updateLocalLake(lake.id, "is_private", event.target.checked)}
                    />
                    <span>Private lake</span>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={Boolean(lake.is_reservable)}
                      onChange={(event) =>
                        updateLocalLake(lake.id, "is_reservable", event.target.checked)
                      }
                    />
                    <span>Accept reservations</span>
                  </label>
                </div>

                <div className={styles.formStack}>
                  <div>
                    <div className={styles.fieldLabel}>Description</div>
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      value={lake.description || ""}
                      onChange={(event) => updateLocalLake(lake.id, "description", event.target.value)}
                    />
                  </div>

                  <div>
                    <div className={styles.fieldLabel}>Availability notes</div>
                    <textarea
                      className={styles.textarea}
                      rows={3}
                      value={lake.availability_notes || ""}
                      onChange={(event) =>
                        updateLocalLake(lake.id, "availability_notes", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={savingId === lake.id}
                    onClick={() => handleSaveLake(lake)}
                  >
                    {savingId === lake.id ? "Saving..." : "Save lake changes"}
                  </button>
                </div>

                <div className={styles.blockedDatesSection}>
                  <h4 className={styles.subsectionTitle}>Blocked dates</h4>
                  <div className={styles.formGrid}>
                    <div>
                      <div className={styles.fieldLabel}>Date</div>
                      <input
                        className={styles.input}
                        type="date"
                        value={blockedDateInputs[lake.id] || ""}
                        onChange={(event) =>
                          setBlockedDateInputs((prev) => ({ ...prev, [lake.id]: event.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <div className={styles.fieldLabel}>Reason (optional)</div>
                      <input
                        className={styles.input}
                        type="text"
                        value={blockedReasonInputs[lake.id] || ""}
                        onChange={(event) =>
                          setBlockedReasonInputs((prev) => ({ ...prev, [lake.id]: event.target.value }))
                        }
                        placeholder="Maintenance, event, private booking..."
                      />
                    </div>
                  </div>

                  <div className={styles.actionRowLeft}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={blockingLakeId === lake.id}
                      onClick={() => handleAddBlockedDate(lake.id)}
                    >
                      {blockingLakeId === lake.id ? "Saving..." : "Add blocked date"}
                    </button>
                  </div>

                  {!blockedDatesByLake[lake.id]?.length ? (
                    <div className={styles.emptyState}>No blocked dates added yet.</div>
                  ) : (
                    <div className={styles.blockedList}>
                      {blockedDatesByLake[lake.id].map((item) => (
                        <div key={item.id} className={styles.blockedItem}>
                          <div>
                            <div className={styles.blockedDate}>{formatDate(item.blocked_date)}</div>
                            <div className={styles.metaText}>{item.reason || "No reason added"}</div>
                          </div>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={blockingLakeId === lake.id}
                            onClick={() => handleDeleteBlockedDate(lake.id, item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
