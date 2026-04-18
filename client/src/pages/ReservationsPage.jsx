import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  cancelReservation,
  getIncomingReservations,
  getMyReservations,
  updateReservationStatus,
} from "../api/reservationsApi";
import ActionButton from "../components/ui/ActionButton";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import TabButton from "../components/ui/TabButton";
import styles from "./ReservationsPage.module.css";

const PAGE_SIZE = 5;

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

const getStatusCount = (items, status) => {
  if (status === "all") return items.length;
  return items.filter((item) => item.status === status).length;
};

const paginateItems = (items, currentPage, pageSize = PAGE_SIZE) => {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage: safePage,
    startIndex,
    endIndex: Math.min(endIndex, totalItems),
  };
};

const filterReservations = (items, statusFilter, query, textFactory) => {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesQuery = !normalizedQuery || textFactory(item).toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
};

const MY_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

const INCOMING_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const SummaryCard = ({ label, value, note }) => (
  <div className={styles.summaryCard}>
    <div className={styles.summaryLabel}>{label}</div>
    <div className={styles.summaryValue}>{value}</div>
    <div className={styles.summaryNote}>{note}</div>
  </div>
);

export default function ReservationsPage({ currentUser }) {
  const location = useLocation();
  const [myReservations, setMyReservations] = useState([]);
  const [incomingReservations, setIncomingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const [myStatusFilter, setMyStatusFilter] = useState("all");
  const [incomingStatusFilter, setIncomingStatusFilter] = useState("pending");
  const [mySearch, setMySearch] = useState("");
  const [incomingSearch, setIncomingSearch] = useState("");
  const [myPage, setMyPage] = useState(1);
  const [incomingPage, setIncomingPage] = useState(1);

  const mySectionRef = useRef(null);
  const incomingSectionRef = useRef(null);
  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase();
  const canManageIncomingReservations = normalizedRole === "owner" || normalizedRole === "admin";
  const reservationSubmitted = Boolean(location.state?.reservationSubmitted);

  const scrollToSectionTop = (ref) => {
    setTimeout(() => {
      ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      const [myReservationsData, incomingReservationsData] = await Promise.all([
        getMyReservations(),
        canManageIncomingReservations ? getIncomingReservations() : Promise.resolve([]),
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
  }, [canManageIncomingReservations]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => setMyPage(1), [myStatusFilter, mySearch]);
  useEffect(() => setIncomingPage(1), [incomingStatusFilter, incomingSearch]);

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

  const filteredMyReservations = useMemo(
    () => filterReservations(
      myReservations,
      myStatusFilter,
      mySearch,
      (item) => [item.lake_name, item.status, item.notes, item.reservation_date, item.created_at, item.people_count].map((value) => String(value || "")).join(" "),
    ),
    [myReservations, myStatusFilter, mySearch],
  );

  const filteredIncomingReservations = useMemo(
    () => filterReservations(
      incomingReservations,
      incomingStatusFilter,
      incomingSearch,
      (item) => [item.lake_name, item.status, item.notes, item.reservation_date, item.created_at, item.people_count, item.full_name, item.email].map((value) => String(value || "")).join(" "),
    ),
    [incomingReservations, incomingStatusFilter, incomingSearch],
  );

  const myStats = useMemo(() => ({
    total: myReservations.length,
    pending: getStatusCount(myReservations, "pending"),
    approved: getStatusCount(myReservations, "approved"),
    cancelled: getStatusCount(myReservations, "cancelled"),
  }), [myReservations]);

  const incomingStats = useMemo(() => ({
    total: incomingReservations.length,
    pending: getStatusCount(incomingReservations, "pending"),
    approved: getStatusCount(incomingReservations, "approved"),
    rejected: getStatusCount(incomingReservations, "rejected"),
  }), [incomingReservations]);

  const paginatedMyReservations = useMemo(() => paginateItems(filteredMyReservations, myPage), [filteredMyReservations, myPage]);
  const paginatedIncomingReservations = useMemo(() => paginateItems(filteredIncomingReservations, incomingPage), [filteredIncomingReservations, incomingPage]);

  if (loading) {
    return <div className={styles.loading}>Loading reservations...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Reservations</h2>
          <div className={styles.heroText}>
            Track your own bookings and, if you are an owner or admin, review incoming requests from one place.
          </div>
        </div>

        {reservationSubmitted ? (
          <div className={styles.card} style={{ marginBottom: "16px" }}>
            Your reservation request was sent successfully. You can track its status here.
          </div>
        ) : null}

        <div className={styles.summaryGrid}>
          <SummaryCard label="My reservations" value={myStats.total} note={`${myStats.pending} pending · ${myStats.approved} approved`} />
          <SummaryCard label="My cancelled" value={myStats.cancelled} note="Cancelled bookings stay visible for history" />
          {canManageIncomingReservations ? (
            <>
              <SummaryCard label="Incoming requests" value={incomingStats.total} note={`${incomingStats.pending} need action`} />
              <SummaryCard label="Incoming approved" value={incomingStats.approved} note={`${incomingStats.rejected} rejected`} />
            </>
          ) : null}
        </div>

        <div className={styles.stack}>
          <div ref={mySectionRef} className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.cardTitle}>My reservations</h3>
              <SearchInput value={mySearch} onChange={(event) => setMySearch(event.target.value)} placeholder="Search my reservations..." minWidth={260} />
            </div>

            <div className={styles.filterRow}>
              {MY_STATUS_FILTERS.map((filter) => (
                <TabButton key={filter.key} active={myStatusFilter === filter.key} onClick={() => setMyStatusFilter(filter.key)} badge={getStatusCount(myReservations, filter.key)}>
                  {filter.label}
                </TabButton>
              ))}
            </div>

            {filteredMyReservations.length === 0 ? (
              <div className={styles.emptyState}>
                {myReservations.length === 0 ? "You do not have any reservations yet." : "No reservations match the selected filters."}
              </div>
            ) : (
              <>
                <div className={styles.itemList}>
                  {paginatedMyReservations.items.map((item) => (
                    <div key={item.id} className={styles.itemCard}>
                      <div className={styles.splitRow}>
                        <div>
                          <div className={styles.itemTitle}>{item.lake_name}</div>
                          <div className={`${styles.metaText} ${styles.metaBlock}`}>Stay: {formatDate(item.arrival_date || item.start_date)} → {formatDate(item.departure_date || item.end_date)}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Created: {formatDateTime(item.created_at)}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Spots: {item.requested_spots || item.people_count || 1}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Fishing days: {(item.fishing_dates || []).length || 0}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Night fishing: {(item.night_fishing_dates || []).length || 0}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Rooms: {(item.room_names || []).length ? item.room_names.join(", ") : "None"}</div>
                          <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Total: €{Number(item.total_amount || 0).toFixed(2)}</div>
                          <div className={`${styles.noteText} ${styles.noteBlock}`}>Notes: {item.notes || "No notes"}</div>
                        </div>
                        <div className={styles.actionColumn}>
                          <StatusBadge status={item.status} />
                          {item.status !== "cancelled" ? (
                            <ActionButton type="button" tone="danger" compact disabled={savingId === item.id} onClick={() => handleCancelReservation(item.id)}>
                              Cancel
                            </ActionButton>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={paginatedMyReservations.currentPage} totalPages={paginatedMyReservations.totalPages} totalItems={paginatedMyReservations.totalItems} startIndex={paginatedMyReservations.startIndex} endIndex={paginatedMyReservations.endIndex} onPageChange={(page) => { setMyPage(page); scrollToSectionTop(mySectionRef); }} />
              </>
            )}
          </div>

          {canManageIncomingReservations ? (
            <div ref={incomingSectionRef} className={styles.card}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.cardTitle}>Incoming reservations</h3>
                <SearchInput value={incomingSearch} onChange={(event) => setIncomingSearch(event.target.value)} placeholder="Search incoming reservations..." minWidth={260} />
              </div>

              <div className={styles.filterRow}>
                {INCOMING_STATUS_FILTERS.map((filter) => (
                  <TabButton key={filter.key} active={incomingStatusFilter === filter.key} onClick={() => setIncomingStatusFilter(filter.key)} badge={getStatusCount(incomingReservations, filter.key)}>
                    {filter.label}
                  </TabButton>
                ))}
              </div>

              {filteredIncomingReservations.length === 0 ? (
                <div className={styles.emptyState}>
                  {incomingReservations.length === 0 ? "No incoming reservations for your private lakes." : "No incoming reservations match the selected filters."}
                </div>
              ) : (
                <>
                  <div className={styles.itemList}>
                    {paginatedIncomingReservations.items.map((item) => (
                      <div key={item.id} className={styles.itemCard}>
                        <div className={styles.splitRow}>
                          <div>
                            <div className={styles.itemTitle}>{item.lake_name}</div>
                            <div className={`${styles.metaText} ${styles.metaBlock}`}>User: {item.full_name || "Unknown"} {item.email ? `(${item.email})` : ""}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Stay: {formatDate(item.arrival_date || item.start_date)} → {formatDate(item.departure_date || item.end_date)}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Created: {formatDateTime(item.created_at)}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Spots: {item.requested_spots || item.people_count || 1}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Fishing days: {(item.fishing_dates || []).length || 0}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Night fishing: {(item.night_fishing_dates || []).length || 0}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Rooms: {(item.room_names || []).length ? item.room_names.join(", ") : "None"}</div>
                            <div className={`${styles.metaText} ${styles.metaBlockCompact}`}>Total: €{Number(item.total_amount || 0).toFixed(2)}</div>
                            <div className={`${styles.noteText} ${styles.noteBlock}`}>Notes: {item.notes || "No notes"}</div>
                          </div>
                          <div className={styles.actionColumn}>
                            <StatusBadge status={item.status} />
                            <div className={styles.buttonRow}>
                              <ActionButton type="button" tone="success" compact disabled={savingId === item.id} onClick={() => handleUpdateIncomingStatus(item.id, "approved")}>Approve</ActionButton>
                              <ActionButton type="button" tone="danger" compact disabled={savingId === item.id} onClick={() => handleUpdateIncomingStatus(item.id, "rejected")}>Reject</ActionButton>
                              <ActionButton type="button" tone="neutral" compact disabled={savingId === item.id} onClick={() => handleUpdateIncomingStatus(item.id, "pending")}>Mark Pending</ActionButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Pagination currentPage={paginatedIncomingReservations.currentPage} totalPages={paginatedIncomingReservations.totalPages} totalItems={paginatedIncomingReservations.totalItems} startIndex={paginatedIncomingReservations.startIndex} endIndex={paginatedIncomingReservations.endIndex} onPageChange={(page) => { setIncomingPage(page); scrollToSectionTop(incomingSectionRef); }} />
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
