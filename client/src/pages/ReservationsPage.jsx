import React, { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  cancelReservation,
  getIncomingReservations,
  getMyReservations,
  updateReservationStatus,
} from "../api/reservationsApi";
import ActionButton from "../components/ui/ActionButton";
import StatusBadge from "../components/ui/StatusBadge";
import styles from "./ReservationsPage.module.css";

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function ReservationsPage() {
  const [myReservations, setMyReservations] = useState([]);
  const [incomingReservations, setIncomingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const loadReservations = async () => {
    try {
      setLoading(true);

      const [myReservationsData, incomingReservationsData] = await Promise.all([
        getMyReservations(),
        getIncomingReservations(),
      ]);

      setMyReservations(myReservationsData || []);
      setIncomingReservations(incomingReservationsData || []);
    } catch (error) {
      notifyError(error, "Failed to load reservations");
      setMyReservations([]);
      setIncomingReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleCancelReservation = async (reservationId) => {
    try {
      setSavingId(reservationId);
      await cancelReservation(reservationId);
      notifySuccess("Reservation cancelled");
      await loadReservations();
    } catch (error) {
      notifyError(error, "Failed to cancel reservation");
    } finally {
      setSavingId("");
    }
  };

  const handleUpdateIncomingStatus = async (reservationId, status) => {
    try {
      setSavingId(reservationId);
      await updateReservationStatus(reservationId, status);
      notifySuccess("Reservation updated");
      await loadReservations();
    } catch (error) {
      notifyError(error, "Failed to update reservation");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading reservations...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Reservations</h2>
          <div className={styles.heroText}>
            Manage your reservation requests and review incoming requests for
            lakes you own.
          </div>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>My reservations</h3>

            {myReservations.length === 0 ? (
              <div className={styles.emptyState}>
                You do not have any reservations yet.
              </div>
            ) : (
              <div className={styles.itemList}>
                {myReservations.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.splitRow}>
                      <div>
                        <div className={styles.itemTitle}>
                          {item.lake_name}
                        </div>
                        <div className={`${styles.metaText} ${styles.metaBlock}`}>
                          Date: {formatDate(item.reservation_date)}
                        </div>
                        <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>
                          Created: {formatDateTime(item.created_at)}
                        </div>
                        <div className={`${styles.noteText} ${styles.noteBlock}`}>
                          Notes: {item.notes || "No notes"}
                        </div>
                      </div>

                      <div className={styles.actionColumn}>
                        <StatusBadge status={item.status} />

                        {item.status !== "cancelled" && (
                          <ActionButton
                            type="button"
                            tone="danger"
                            compact
                            disabled={savingId === item.id}
                            onClick={() => handleCancelReservation(item.id)}
                          >
                            Cancel
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Incoming reservations</h3>

            {incomingReservations.length === 0 ? (
              <div className={styles.emptyState}>
                No incoming reservations for your private lakes.
              </div>
            ) : (
              <div className={styles.itemList}>
                {incomingReservations.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.splitRow}>
                      <div>
                        <div className={styles.itemTitle}>
                          {item.lake_name}
                        </div>
                        <div className={`${styles.metaText} ${styles.metaBlock}`}>
                          User: {item.full_name || "Unknown"}{" "}
                          {item.email ? `(${item.email})` : ""}
                        </div>
                        <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>
                          Date: {formatDate(item.reservation_date)}
                        </div>
                        <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>
                          Created: {formatDateTime(item.created_at)}
                        </div>
                        <div className={`${styles.noteText} ${styles.noteBlock}`}>
                          Notes: {item.notes || "No notes"}
                        </div>
                      </div>

                      <div className={styles.actionColumn}>
                        <StatusBadge status={item.status} />

                        <div className={styles.buttonRow}>
                          <ActionButton
                            type="button"
                            tone="success"
                            compact
                            disabled={savingId === item.id}
                            onClick={() =>
                              handleUpdateIncomingStatus(item.id, "approved")
                            }
                          >
                            Approve
                          </ActionButton>

                          <ActionButton
                            type="button"
                            tone="danger"
                            compact
                            disabled={savingId === item.id}
                            onClick={() =>
                              handleUpdateIncomingStatus(item.id, "rejected")
                            }
                          >
                            Reject
                          </ActionButton>

                          <ActionButton
                            type="button"
                            tone="neutral"
                            compact
                            disabled={savingId === item.id}
                            onClick={() =>
                              handleUpdateIncomingStatus(item.id, "pending")
                            }
                          >
                            Mark Pending
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}