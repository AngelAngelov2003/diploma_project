import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarCheck } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  cancelReservation,
  getMyReservations,
  startReservationPayment,
} from "../api/reservationsApi";
import ActionButton from "../components/ui/ActionButton";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import TabButton from "../components/ui/TabButton";
import PageLoadingState from "../components/common/PageLoadingState";
import styles from "./ReservationsPage.module.css";

const PAGE_SIZE = 5;

const formatDate = (value) => {
  if (!value) return "Неизвестна дата";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "Неизвестен час";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const isReservationPast = (item) => {
  const departure = String(item?.departure_date || item?.end_date || item?.start_date || item?.reservation_date || "").slice(0, 10);
  return Boolean(departure && departure < getTodayDateString());
};

const canCancelReservation = (item) => {
  if (isReservationPast(item)) return false;
  if (item?.payment_status === "paid") return false;
  if (typeof item?.can_cancel === "boolean") return item.can_cancel;
  return ["pending", "approved"].includes(String(item?.status || ""));
};

const canPayReservation = (item) => {
  if (isReservationPast(item)) return false;
  return item?.status === "approved_waiting_payment" && item?.payment_status !== "paid" && Number(item?.total_amount || 0) > 0;
};

const getPaymentLabel = (item) => {
  if (item?.payment_status === "paid") return "Платено";
  if (item?.status === "approved_waiting_payment") return "Очаква плащане";
  if (item?.payment_status === "checkout_started") return "Плащането е започнато";
  return item?.payment_status || "Ръчно / неплатено";
};

const getValidApprovedCount = (items) =>
  items.filter((item) => item.status === "approved" && !isReservationPast(item)).length;

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


const getReservedSpotNumbers = (item) => (
  Array.isArray(item.spot_numbers)
    ? item.spot_numbers.filter((value) => value !== null && value !== undefined)
    : []
);

const formatReservedSpots = (item) => {
  const spotNumbers = getReservedSpotNumbers(item);

  if (spotNumbers.length) {
    return `${spotNumbers.length} избрани`;
  }

  const count = item.requested_spots || item.people_count || 1;
  return `${count} заявени`;
};

function ReservedSpotsChip({ item }) {
  const spotNumbers = getReservedSpotNumbers(item);

  return (
    <div className={`${styles.metaText} ${styles.metaChip} ${spotNumbers.length ? styles.spotChip : ""}`}>
      <div>Запазени места: {formatReservedSpots(item)}</div>
      {spotNumbers.length ? (
        <details className={styles.spotDetails}>
          <summary>Виж номерата на местата</summary>
          <div className={styles.spotNumberList}>
            {spotNumbers.map((value) => (
              <span key={value} className={styles.spotNumberPill}>
                Място {value}
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

const filterReservations = (items, statusFilter, query, textFactory) => {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesQuery = !normalizedQuery || textFactory(item).toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
};

const MY_STATUS_FILTERS = [
  { key: "all", label: "Всички" },
  { key: "pending", label: "Чакащи" },
  { key: "approved", label: "Одобрени" },
  { key: "rejected", label: "Отхвърлени" },
  { key: "cancelled", label: "Отказани" },
];

export default function ReservationsPage() {
  const location = useLocation();
  const [myReservations, setMyReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [payingId, setPayingId] = useState("");

  const [myStatusFilter, setMyStatusFilter] = useState("all");
  const [mySearch, setMySearch] = useState("");
  const [myPage, setMyPage] = useState(1);

  const mySectionRef = useRef(null);
  const reservationSubmitted = Boolean(location.state?.reservationSubmitted);
  const paymentSuccess = new URLSearchParams(location.search).get("payment") === "success";
  const paymentCancelled = new URLSearchParams(location.search).get("payment") === "cancelled";

  const scrollToSectionTop = (ref) => {
    setTimeout(() => {
      ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      const myReservationsData = await getMyReservations();
      setMyReservations(myReservationsData || []);
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на резервации");
      setMyReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => setMyPage(1), [myStatusFilter, mySearch]);

  const handleCancelReservation = async (reservationId) => {
    try {
      setSavingId(reservationId);
      await cancelReservation(reservationId);
      notifySuccess("Резервацията е отказана");
      await loadReservations();
    } catch (error) {
      notifyError(error, "Неуспешно отказване на резервацията");
    } finally {
      setSavingId("");
    }
  };

  const handlePayReservation = async (reservationId) => {
    try {
      setPayingId(reservationId);
      const result = await startReservationPayment(reservationId);
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      notifyError(null, "Не беше върнат линк за плащане чрез Stripe");
    } catch (error) {
      notifyError(error, "Неуспешно стартиране на плащането");
    } finally {
      setPayingId("");
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

  const paginatedMyReservations = useMemo(() => paginateItems(filteredMyReservations, myPage), [filteredMyReservations, myPage]);

  if (loading) {
    return <PageLoadingState title="Зареждане на резервации..." subtitle="Зареждаме вашите заявки, плащания и статуси по резервациите." cards={3} rows={4} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroHeader}>
            <div className={styles.heroIntro}>
              <div className={styles.heroEyebrow}>
                <FaCalendarCheck />
                <span>Моите резервации</span>
              </div>
              <h2 className={styles.heroTitle}>Моите резервации</h2>
            </div>
            </div>
        </div>

        {reservationSubmitted ? (
          <div className={styles.card} style={{ marginBottom: "16px" }}>
            Заявката за резервация беше изпратена успешно. Можете да следите статуса ѝ тук.
          </div>
        ) : null}

        {paymentSuccess ? (
          <div className={styles.card} style={{ marginBottom: "16px" }}>
            Плащането е завършено. Ако статусът още не е обновен, презаредете страницата след обработката от Stripe.
          </div>
        ) : null}

        {paymentCancelled ? (
          <div className={styles.card} style={{ marginBottom: "16px" }}>
            Плащането беше отменено. Можете да стартирате плащането отново от картата на резервацията.
          </div>
        ) : null}

        <div className={styles.stack}>
          <div ref={mySectionRef} className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.cardTitle}>Моите резервации</h3>
              <SearchInput value={mySearch} onChange={(event) => setMySearch(event.target.value)} placeholder="Търсене в моите резервации..." minWidth={260} />
            </div>

            <div className={styles.filterRow}>
              {MY_STATUS_FILTERS.map((filter) => (
                <TabButton
                  key={filter.key}
                  active={myStatusFilter === filter.key}
                  activeClassName={styles.reservationFilterActive}
                  onClick={() => setMyStatusFilter(filter.key)}
                  badge={filter.key === "approved" ? getValidApprovedCount(myReservations) : null}
                >
                  {filter.label}
                </TabButton>
              ))}
            </div>

            {filteredMyReservations.length === 0 ? (
              <div className={styles.emptyState}>
                {myReservations.length === 0 ? "Все още нямате резервации." : "Няма резервации, които съвпадат с избраните филтри."}
              </div>
            ) : (
              <>
                <div className={styles.itemList}>
                  {paginatedMyReservations.items.map((item) => (
                    <div key={item.id} className={styles.itemCard}>
                      <div className={styles.splitRow}>
                        <div>
                          <div className={styles.itemTitle}>{item.lake_name}</div>
                          <div className={`${styles.metaText} ${styles.metaBlock}`}>Престой: {formatDate(item.arrival_date || item.start_date)} → {formatDate(item.departure_date || item.end_date)}</div>
                          <div className={styles.metaGrid}>
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Създадена: {formatDateTime(item.created_at)}</div>
                            <ReservedSpotsChip item={item} />
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Дни за риболов: {(item.fishing_dates || []).length || 0}</div>
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Нощен риболов: {(item.night_fishing_dates || []).length || 0}</div>
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Стаи: {(item.room_names || []).length ? item.room_names.join(", ") : "Няма"}</div>
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Общо: €{Number(item.total_amount || 0).toFixed(2)}</div>
                            <div className={`${styles.metaText} ${styles.metaChip}`}>Плащане: {getPaymentLabel(item)}</div>
                          </div>
                          <div className={`${styles.noteText} ${styles.noteBlock}`}>Бележки: {item.notes || "Няма бележки"}</div>
                        </div>
                        <div className={styles.actionColumn}>
                          <StatusBadge status={item.status} />
                          {isReservationPast(item) ? (
                            <div className={styles.metaText}>Минала резервация</div>
                          ) : null}
                          {canPayReservation(item) ? (
                            <ActionButton type="button" compact disabled={payingId === item.id} onClick={() => handlePayReservation(item.id)}>
                              {payingId === item.id ? "Отваряне..." : "Плати сега"}
                            </ActionButton>
                          ) : null}
                          {canCancelReservation(item) ? (
                            <ActionButton type="button" tone="danger" compact disabled={savingId === item.id} onClick={() => handleCancelReservation(item.id)}>
                              Откажи
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

        </div>
      </div>
    </div>
  );
}
