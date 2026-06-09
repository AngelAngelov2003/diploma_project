import React, { useEffect, useState } from "react";
import { FaChartLine, FaExternalLinkAlt, FaMoneyBillWave, FaPlug, FaUserCog } from "react-icons/fa";
import {
  addBlockedDate,
  createLakeRoom,
  deleteBlockedDate,
  deleteLakePhoto,
  deleteLakeRoom,
  deleteOwnerCatchPhoto,
  getOwnerLakeCatches,
  getOwnerLakeReservations,
  getOwnerLakeSpotAvailability,
  getOwnerLakeEarnings,
  reportOwnerLakeCatch,
  getBlockedDates,
  getLakePhotos,
  getLakeRooms,
  getLakeSpots,
  getOwnerLakes,
  syncLakeSpots,
  updateLakeRoom,
  updateLakeSpot,
  updateOwnerLake,
  uploadLakePhoto,
} from "../api/ownerApi";
import { getOwnerBillingStatus, getOwnerRevenueSummary } from "../api/billingApi";
import { updateReservationStatus } from "../api/reservationsApi";
import OwnerProLockedCard from "../components/common/OwnerProLockedCard";
import { notifyError, notifySuccess } from "../ui/toast";
import { formatCurrency } from "../utils/formatCurrency";
import DatePicker from "../components/ui/DatePicker";
import ZoomableImage from "../components/ui/ZoomableImage";
import Pagination from "../components/ui/Pagination";
import styles from "./OwnerPanel.module.css";

const DEFAULT_ROOM_FORM = {
  name: "",
  capacity: 1,
  price_per_night: 0,
  is_active: true,
  sort_order: 0,
};

const DEFAULT_ROOM_BULK_FORM = {
  prefix: "Стая",
  from: 1,
  to: 5,
  capacity: 2,
  price_per_night: 30,
  is_active: true,
};

const SPOTS_PAGE_SIZE = 12;
const BILLING_TRANSACTIONS_PAGE_SIZE = 8;
const MONTHLY_REPORTS_PAGE_SIZE = 4;
const ROOMS_PAGE_SIZE = 5;

const getUploadUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:/i.test(imageUrl) || imageUrl.startsWith("blob:")) return imageUrl;
  return `http://localhost:5000/uploads/${imageUrl}`;
};

const parseMoneyInput = (value) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

const TAB_ITEMS = [
  { key: "overview", label: "Обзор" },
  { key: "reservations", label: "Резервации" },
  { key: "spots", label: "Риболовни места" },
  { key: "rooms", label: "Настаняване / стаи" },
  { key: "gallery", label: "Галерия и медия" },
  { key: "blocked", label: "Блокирани дати" },
  { key: "billing", label: "Плащания и приходи" },
];

const normalizeLakePayload = (lake) => ({
  name: lake.name,
  description: lake.description || "",
  type: lake.type || "",
  is_private: Boolean(lake.is_private),
  price_per_day: Number(lake.price_per_day || 0),
  capacity: Number(lake.capacity || 1),
  spots_count: Number(lake.spots_count || 0),
  is_reservable: Boolean(lake.is_reservable),
  availability_notes: lake.availability_notes || "",
  allows_night_fishing: Boolean(lake.allows_night_fishing),
  night_fishing_price: Boolean(lake.allows_night_fishing)
    ? Number(lake.night_fishing_price || 0)
    : 0,
  has_housing: Boolean(lake.has_housing),
});

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
  return date.toLocaleString("bg-BG");
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const isReservationPast = (reservation) => {
  const departure = String(reservation?.departure_date || reservation?.end_date || reservation?.start_date || reservation?.reservation_date || "").slice(0, 10);
  return Boolean(departure && departure < getTodayDateString());
};

const getReservedSpotNumbers = (item) => (
  Array.isArray(item?.spot_numbers)
    ? item.spot_numbers.filter((value) => value !== null && value !== undefined)
    : []
);

const formatReservedSpots = (item) => {
  const numbers = getReservedSpotNumbers(item);
  if (numbers.length) return `${numbers.length} избрани`;
  const count = Number(item?.requested_spots || item?.people_count || 1);
  return `${count} заявени`;
};

const getReservationPaymentLabel = (reservation) => {
  if (reservation?.payment_status === "paid") return "Платено";
  if (reservation?.status === "approved_waiting_payment") return "Очаква плащане от потребителя";
  if (reservation?.payment_status === "checkout_started") return "Плащането е започнато";
  return reservation?.payment_required ? "Изисква се плащане" : "Ръчно / неплатено";
};

function ReservedSpotsBadge({ reservation }) {
  const numbers = getReservedSpotNumbers(reservation);

  return (
    <span className={`${styles.mutedBadge} ${styles.reservationSpotBadge}`}>
      <span>Запазени места: {formatReservedSpots(reservation)}</span>
      {numbers.length ? (
        <details className={styles.reservationSpotDetails}>
          <summary>Виж номерата на местата</summary>
          <span className={styles.reservationSpotList}>
            {numbers.map((value) => (
              <span key={value} className={styles.reservationSpotPill}>
                Място {value}
              </span>
            ))}
          </span>
        </details>
      ) : null}
    </span>
  );
}

const OWNER_RESERVATION_FILTERS = ["pending", "approved_waiting_payment", "approved", "rejected", "cancelled", "all"];

const getLakeModeLabel = (lake) => {
  if (lake.is_private && lake.is_reservable) return "Частен и с резервации";
  if (lake.is_private) return "Частен";
  if (lake.is_reservable) return "Приема резервации";
  return "Публичен";
};

const getTabDescription = (tabKey) => {
  if (tabKey === "overview") {
    return "Управлявайте основните настройки, правилата за резервации и цените на водоема от едно място.";
  }
  if (tabKey === "reservations") {
    return "Преглеждайте заявки за резервации и проверявайте наличността за избрани дати.";
  }
  if (tabKey === "spots") {
    return "Създавайте и управлявайте отделни риболовни места за този водоем.";
  }
  if (tabKey === "rooms") {
    return "Създавайте опции за настаняване като къщи или бунгала за гости.";
  }
  if (tabKey === "gallery") {
    return "Качвайте и управлявайте медията, която се показва за този водоем.";
  }
  if (tabKey === "blocked") {
    return "Предотвратете резервации за дати, запазени за поддръжка, събития или частно ползване.";
  }
  return "Следете приходи от водоема, такси на платформата, печалба на собственика, месечни отчети и готовност за Stripe изплащания.";
};

const LabeledInput = ({ label, children, hint }) => (
  <div>
    <div className={styles.fieldLabel}>{label}</div>
    {children}
    {hint ? <div className={styles.fieldHint}>{hint}</div> : null}
  </div>
);

const SectionCard = ({ title, subtitle, actions, children }) => (
  <section className={styles.sectionCard}>
    <div className={styles.sectionCardHeader}>
      <div>
        <h4 className={styles.subsectionTitle}>{title}</h4>
        {subtitle ? <div className={styles.sectionSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={styles.sectionCardActions}>{actions}</div> : null}
    </div>
    {children}
  </section>
);

export default function OwnerPanel() {
  const [lakes, setLakes] = useState([]);
  const [blockedDatesByLake, setBlockedDatesByLake] = useState({});
  const [blockedDateInputs, setBlockedDateInputs] = useState({});
  const [blockedEndDateInputs, setBlockedEndDateInputs] = useState({});
  const [blockedReasonInputs, setBlockedReasonInputs] = useState({});
  const [spotsByLake, setSpotsByLake] = useState({});
  const [roomsByLake, setRoomsByLake] = useState({});
  const [photosByLake, setPhotosByLake] = useState({});
  const [catchPhotosByLake, setCatchPhotosByLake] = useState({});
  const [reservationsByLake, setReservationsByLake] = useState({});
  const [earningsByLake, setEarningsByLake] = useState({});
  const [reservationFilterByLake, setReservationFilterByLake] = useState({});
  const [spotAvailabilityDateByLake, setSpotAvailabilityDateByLake] = useState({});
  const [spotAvailabilityByLake, setSpotAvailabilityByLake] = useState({});
  const [newRoomByLake, setNewRoomByLake] = useState({});
  const [photoFilesByLake, setPhotoFilesByLake] = useState({});
  const [photoCaptionsByLake, setPhotoCaptionsByLake] = useState({});
  const [photoPreviewsByLake, setPhotoPreviewsByLake] = useState({});
  const [activeTabByLake, setActiveTabByLake] = useState({});
  const [roomModalByLake, setRoomModalByLake] = useState({});
  const [roomDraftByLake, setRoomDraftByLake] = useState({});
  const [roomBulkDraftByLake, setRoomBulkDraftByLake] = useState({});
  const [roomPageByLake, setRoomPageByLake] = useState({});
  const [spotPageByLake, setSpotPageByLake] = useState({});
  const [billingTransactionPageByLake, setBillingTransactionPageByLake] = useState({});
  const [monthlyReportPageByLake, setMonthlyReportPageByLake] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [busyLakeId, setBusyLakeId] = useState("");
  const [ownerBilling, setOwnerBilling] = useState(null);
  const [ownerRevenue, setOwnerRevenue] = useState(null);

  const loadOwnerPanel = async () => {
    try {
      setLoading(true);
      const [owned, billingStatus, revenueSummary] = await Promise.all([
        getOwnerLakes(),
        getOwnerBillingStatus().catch(() => null),
        getOwnerRevenueSummary().catch(() => null),
      ]);
      const normalizedLakes = Array.isArray(owned) ? owned : [];
      setLakes(normalizedLakes);
      setOwnerBilling(billingStatus);
      setOwnerRevenue(revenueSummary);

      const [blockedEntries, spotEntries, roomEntries, photoEntries, catchPhotoEntries, reservationEntries, earningsEntries] = await Promise.all([
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getBlockedDates(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakeSpots(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakeRooms(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakePhotos(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeCatches(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeReservations(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeEarnings(lake.id).catch(() => null),
          ])
        ),
      ]);

      setBlockedDatesByLake(Object.fromEntries(blockedEntries));
      setSpotsByLake(Object.fromEntries(spotEntries));
      setRoomsByLake(Object.fromEntries(roomEntries));
      setPhotosByLake(Object.fromEntries(photoEntries));
      setCatchPhotosByLake(Object.fromEntries(catchPhotoEntries));
      setReservationsByLake(Object.fromEntries(reservationEntries));
      setEarningsByLake(Object.fromEntries(earningsEntries));
      setNewRoomByLake(
        Object.fromEntries(
          normalizedLakes.map((lake) => [lake.id, { ...DEFAULT_ROOM_FORM }])
        )
      );
      const params = new URLSearchParams(window.location.search);
      const shouldOpenBilling = ["success", "cancelled"].includes(params.get("checkout")) ||
        ["return", "refresh"].includes(params.get("connect"));

      setActiveTabByLake(
        Object.fromEntries(normalizedLakes.map((lake, index) => [
          lake.id,
          shouldOpenBilling && index === 0 ? "billing" : "overview",
        ]))
      );

      if (shouldOpenBilling) {
        if (params.get("checkout") === "success") {
          notifySuccess("Настройката за изплащания е обновена.");
        }
        if (params.get("connect") === "return") {
          notifySuccess("Stripe Connect настройката се върна. Обновете статуса, за да потвърдите последното състояние.");
        }
        if (params.get("connect") === "refresh") {
          notifyError("Stripe onboarding линкът е изтекъл. Стартирайте настройката отново.");
        }
        window.history.replaceState({}, "", "/owner");
      }
      setSpotPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setBillingTransactionPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setMonthlyReportPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setReservationFilterByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, "pending"]))
      );
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на водоемите на собственика");
      setLakes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerPanel();
  }, []);

  const updateLocalLake = (lakeId, field, value) => {
    if (field === "has_housing" && !value) {
      setActiveTabByLake((current) => ({
        ...current,
        [lakeId]: current[lakeId] === "rooms" ? "overview" : current[lakeId] || "overview",
      }));
    }

    setLakes((prev) =>
      prev.map((lake) => {
        if (lake.id !== lakeId) {
          return lake;
        }

        if (field === "allows_night_fishing") {
          return {
            ...lake,
            allows_night_fishing: value,
            night_fishing_price: value ? lake.night_fishing_price || 0 : 0,
          };
        }

        return { ...lake, [field]: value };
      })
    );
  };

  const updateNestedItem = (setter, lakeId, itemId, field, value) => {
    setter((prev) => ({
      ...prev,
      [lakeId]: (prev[lakeId] || []).map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSaveLake = async (lake) => {
    if (lake.allows_night_fishing && Number(lake.night_fishing_price || 0) <= 0) {
      notifyError(null, "Добавете валидна цена за нощен риболов преди запазване");
      return;
    }

    try {
      setSavingId(lake.id);
      const updatedLake = await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      setLakes((prev) =>
        prev.map((item) => (item.id === lake.id ? { ...item, ...updatedLake } : item))
      );
      notifySuccess("Настройките на водоема са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на настройките на водоема");
    } finally {
      setSavingId("");
    }
  };

  const handleAddBlockedDate = async (lakeId) => {
    const start_date = blockedDateInputs[lakeId] || "";
    const end_date = blockedEndDateInputs[lakeId] || start_date || "";
    const reason = blockedReasonInputs[lakeId] || "";

    if (!start_date || !end_date) {
      notifyError(null, "Първо изберете начална и крайна дата");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const savedBlockedDates = await addBlockedDate(lakeId, { start_date, end_date, reason });
      const nextItems = Array.isArray(savedBlockedDates) ? savedBlockedDates : [savedBlockedDates];
      setBlockedDatesByLake((prev) => ({
        ...prev,
        [lakeId]: [...(prev[lakeId] || []), ...nextItems]
          .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
          .sort((a, b) => String(a.blocked_date).localeCompare(String(b.blocked_date))),
      }));
      setBlockedDateInputs((prev) => ({ ...prev, [lakeId]: "" }));
      setBlockedEndDateInputs((prev) => ({ ...prev, [lakeId]: "" }));
      setBlockedReasonInputs((prev) => ({ ...prev, [lakeId]: "" }));
      notifySuccess("Диапазонът от блокирани дати е запазен");
    } catch (error) {
      notifyError(error, "Неуспешно запазване на блокираните дати");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteBlockedDate = async (lakeId, blockedDateId) => {
    try {
      setBusyLakeId(lakeId);
      await deleteBlockedDate(lakeId, blockedDateId);
      setBlockedDatesByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== blockedDateId),
      }));
      notifySuccess("Блокираната дата е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на блокираната дата");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleGenerateSpots = async (lake) => {
    const spotsCount = Number(lake.spots_count || 0);

    if (!Number.isInteger(spotsCount) || spotsCount < 0) {
      notifyError(null, "Броят места трябва да е 0 или повече");
      return;
    }

    try {
      setBusyLakeId(lake.id);
      await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      const synced = await syncLakeSpots(lake.id, spotsCount);

      setSpotsByLake((prev) => ({
        ...prev,
        [lake.id]: Array.isArray(synced) ? synced : [],
      }));
      setSpotPageByLake((prev) => ({ ...prev, [lake.id]: 1 }));

      setLakes((prev) =>
        prev.map((item) =>
          item.id === lake.id ? { ...item, spots_count: spotsCount } : item
        )
      );

      notifySuccess("Риболовните места са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно генериране на риболовни места");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleToggleSpotActive = async (lakeId, spot) => {
    try {
      setBusyLakeId(lakeId);
      const updated = await updateLakeSpot(lakeId, spot.id, {
        is_active: !spot.is_active,
      });

      setSpotsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).map((item) =>
          item.id === spot.id ? updated : item
        ),
      }));

      notifySuccess("Мястото е обновено");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на мястото");
    } finally {
      setBusyLakeId("");
    }
  };

  const getNextRoomNumber = (lakeId) => {
    const rooms = roomsByLake[lakeId] || [];
    const highestNumber = rooms.reduce((max, room) => {
      const match = String(room.name || "").match(/(\d+)\s*$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return highestNumber + 1;
  };

  const openCreateRoomModal = (lakeId) => {
    const nextRoomNumber = getNextRoomNumber(lakeId);
    const defaultSingleRoom = {
      ...(newRoomByLake[lakeId] || DEFAULT_ROOM_FORM),
      name: `Стая ${nextRoomNumber}`,
    };

    setRoomDraftByLake((prev) => ({
      ...prev,
      [lakeId]: defaultSingleRoom,
    }));
    setRoomBulkDraftByLake((prev) => ({
      ...prev,
      [lakeId]: {
        ...(prev[lakeId] || DEFAULT_ROOM_BULK_FORM),
        from: nextRoomNumber,
        to: nextRoomNumber + 4,
      },
    }));
    setRoomModalByLake((prev) => ({ ...prev, [lakeId]: true }));
  };

  const closeRoomModal = (lakeId) => {
    setRoomModalByLake((prev) => ({ ...prev, [lakeId]: false }));
  };

  const handleRoomDraftChange = (lakeId, field, value) => {
    setRoomDraftByLake((prev) => ({
      ...prev,
      [lakeId]: {
        ...(prev[lakeId] || DEFAULT_ROOM_FORM),
        [field]: value,
      },
    }));
  };

  const handleRoomBulkDraftChange = (lakeId, field, value) => {
    setRoomBulkDraftByLake((prev) => ({
      ...prev,
      [lakeId]: {
        ...(prev[lakeId] || DEFAULT_ROOM_BULK_FORM),
        [field]: value,
      },
    }));
  };

  const handleCreateRoom = async (lakeId) => {
    const payload = roomDraftByLake[lakeId] || newRoomByLake[lakeId] || DEFAULT_ROOM_FORM;

    if (!String(payload.name || "").trim()) {
      notifyError(null, "Първо добавете име на стая");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const created = await createLakeRoom(lakeId, payload);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: [...(prev[lakeId] || []), created],
      }));
      setNewRoomByLake((prev) => ({
        ...prev,
        [lakeId]: { ...DEFAULT_ROOM_FORM },
      }));
      setRoomDraftByLake((prev) => ({
        ...prev,
        [lakeId]: { ...DEFAULT_ROOM_FORM },
      }));
      setRoomModalByLake((prev) => ({ ...prev, [lakeId]: false }));
      notifySuccess("Стаята е добавена");
    } catch (error) {
      notifyError(error, "Неуспешно създаване на стая");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleCreateRoomBatch = async (lakeId) => {
    const draft = roomBulkDraftByLake[lakeId] || DEFAULT_ROOM_BULK_FORM;
    const prefix = String(draft.prefix || "Стая").trim();
    const from = Number(draft.from || 1);
    const to = Number(draft.to || from);
    const capacity = Number(draft.capacity || 1);
    const pricePerNight = Number(draft.price_per_night || 0);

    if (!prefix) {
      notifyError(null, "Добавете префикс за имената");
      return;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      notifyError(null, "Въведете валиден диапазон от номера");
      return;
    }
    if (to - from + 1 > 100) {
      notifyError(null, "Можете да добавите максимум 100 стаи наведнъж");
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      notifyError(null, "Капацитетът трябва да е поне 1");
      return;
    }
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) {
      notifyError(null, "Цената трябва да е 0 или повече");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const createdRooms = [];
      for (let number = from; number <= to; number += 1) {
        const created = await createLakeRoom(lakeId, {
          name: `${prefix} ${number}`,
          capacity,
          price_per_night: pricePerNight,
          is_active: Boolean(draft.is_active),
          sort_order: number,
        });
        createdRooms.push(created);
      }
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: [...(prev[lakeId] || []), ...createdRooms],
      }));
      setRoomBulkDraftByLake((prev) => ({
        ...prev,
        [lakeId]: { ...DEFAULT_ROOM_BULK_FORM, from: to + 1, to: to + 5 },
      }));
      setRoomModalByLake((prev) => ({ ...prev, [lakeId]: false }));
      notifySuccess(`Добавени са ${createdRooms.length} стаи`);
    } catch (error) {
      notifyError(error, "Неуспешно добавяне на стаи");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleSaveRoom = async (lakeId, room) => {
    try {
      setBusyLakeId(lakeId);
      const updated = await updateLakeRoom(lakeId, room.id, room);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).map((item) =>
          item.id === room.id ? updated : item
        ),
      }));
      notifySuccess("Стаята е обновена");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на стаята");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteRoom = async (lakeId, roomId) => {
    try {
      setBusyLakeId(lakeId);
      await deleteLakeRoom(lakeId, roomId);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== roomId),
      }));
      notifySuccess("Стаята е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на стаята");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleUploadPhoto = async (lakeId) => {
    const files = photoFilesByLake[lakeId] || [];

    if (!files.length) {
      notifyError(null, "Първо избери поне една снимка");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const captions = photoCaptionsByLake[lakeId] || [];
      files.forEach((_, index) => formData.append("captions", captions[index] || ""));
      const result = await uploadLakePhoto(lakeId, formData);
      const uploadedItems = Array.isArray(result?.uploaded) ? result.uploaded : [];
      const failedItems = Array.isArray(result?.failed) ? result.failed : [];
      setPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: [...uploadedItems, ...(prev[lakeId] || [])],
      }));
      setPhotoFilesByLake((prev) => ({ ...prev, [lakeId]: [] }));
      setPhotoCaptionsByLake((prev) => ({ ...prev, [lakeId]: [] }));
      setPhotoPreviewsByLake((prev) => ({ ...prev, [lakeId]: [] }));
      if (failedItems.length) {
        notifySuccess(`${uploadedItems.length} качени, ${failedItems.length} неуспешни`);
      } else {
        notifySuccess(uploadedItems.length > 1 ? "Снимките на водоема са качени" : "Снимката на водоема е качена");
      }
    } catch (error) {
      notifyError(error, "Неуспешно качване на снимка");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeletePhoto = async (lakeId, photoId) => {
    try {
      setBusyLakeId(lakeId);
      await deleteLakePhoto(lakeId, photoId);
      setPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== photoId),
      }));
      notifySuccess("Снимката е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на снимка");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteCatchPhoto = async (lakeId, catchId) => {
    try {
      setBusyLakeId(lakeId);
      await deleteOwnerCatchPhoto(lakeId, catchId);
      setCatchPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== catchId),
      }));
      notifySuccess("Снимката към улова на потребителя е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно премахване на снимката към улова на потребителя");
    } finally {
      setBusyLakeId("");
    }
  };


  const refreshOwnerLakeReservations = async (lakeId) => {
    const reservations = await getOwnerLakeReservations(lakeId).catch(() => []);
    setReservationsByLake((prev) => ({ ...prev, [lakeId]: reservations }));
  };

  const handleUpdateReservationStatus = async (lakeId, reservationId, status) => {
    try {
      setBusyLakeId(lakeId);
      await updateReservationStatus(reservationId, status);
      notifySuccess("Резервацията е обновена");
      await refreshOwnerLakeReservations(lakeId);
      const selectedDate = spotAvailabilityDateByLake[lakeId];
      if (selectedDate) {
        const availability = await getOwnerLakeSpotAvailability(lakeId, selectedDate).catch(() => null);
        setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: availability }));
      }
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на резервацията");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleLoadSpotAvailability = async (lakeId, date) => {
    const nextDate = String(date || "").trim();
    setSpotAvailabilityDateByLake((prev) => ({ ...prev, [lakeId]: nextDate }));
    if (!nextDate) {
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: null }));
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const availability = await getOwnerLakeSpotAvailability(lakeId, nextDate);
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: availability }));
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на наличност на местата");
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: null }));
    } finally {
      setBusyLakeId("");
    }
  };

  const hasOwnerPro = true;

  const goToOwnerBilling = () => {
    setActiveTabByLake((prev) => {
      const firstLakeId = lakes[0]?.id;
      return firstLakeId ? { ...prev, [firstLakeId]: "billing" } : prev;
    });
  };

  const renderOwnerProLock = ({ title, message, bullets, compact = false } = {}) => (
    <OwnerProLockedCard
      title={title}
      message={message}
      bullets={bullets}
      compact={compact}
      onUpgrade={goToOwnerBilling}
    />
  );

  const handleReportCatchUser = async (lakeId, catchItem) => {
    const reason = window.prompt("Защо искате да докладвате този потребител/снимка на улов?");
    if (!reason || !reason.trim()) return;

    try {
      setBusyLakeId(lakeId);
      await reportOwnerLakeCatch(lakeId, catchItem.id, { reason: reason.trim() });
      notifySuccess("Сигналът е изпратен до администратор");
    } catch (error) {
      notifyError(error, "Неуспешно докладване на потребителя");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleRefreshLakeEarnings = async (lakeId) => {
    try {
      setBusyLakeId(lakeId);
      const earnings = await getOwnerLakeEarnings(lakeId);
      setEarningsByLake((prev) => ({ ...prev, [lakeId]: earnings }));
      setBillingTransactionPageByLake((prev) => ({ ...prev, [lakeId]: 1 }));
      setMonthlyReportPageByLake((prev) => ({ ...prev, [lakeId]: 1 }));
      const revenueSummary = await getOwnerRevenueSummary().catch(() => null);
      if (revenueSummary) setOwnerRevenue(revenueSummary);
      notifySuccess("Приходите са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на приходите");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleOwnerConnect = async (action) => {
    try {
      setBusyLakeId("billing-action");
      const billingApi = await import("../api/billingApi");
      if (action === "refresh") {
        const [state, revenueSummary] = await Promise.all([
          billingApi.refreshOwnerConnectStatus(),
          billingApi.getOwnerRevenueSummary().catch(() => null),
        ]);
        setOwnerBilling(state);
        if (revenueSummary) setOwnerRevenue(revenueSummary);
        notifySuccess("Статусът за изплащания е обновен");
        return;
      }
      if (action === "portal" || action === "upgrade") {
        setActiveTabByLake((prev) => {
          const firstLakeId = lakes[0]?.id;
          return firstLakeId ? { ...prev, [firstLakeId]: "billing" } : prev;
        });
        return;
      }
      const data = await billingApi.startOwnerConnectOnboarding();
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      notifyError(error, "Неуспешно действие за плащания");
    } finally {
      setBusyLakeId("");
    }
  };


  if (loading) {
    return <div className={styles.loading}>Зареждане на панела на собственика...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            <FaUserCog />
            <span>Панел на собственика</span>
          </div>
          <h2 className={styles.heroTitle}>Панел на собственика</h2>
        </div>

        {!lakes.length ? (
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Все още няма одобрени водоеми</h3>
            <div className={styles.emptyState}>
              When an administrator approves your ownership request, your lakes will
              appear here.
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            {lakes.map((lake) => {
              const activeTab = activeTabByLake[lake.id] || "overview";
              const spotCount = spotsByLake[lake.id]?.length || 0;
              const allRooms = roomsByLake[lake.id] || [];
              const roomCount = allRooms.length;
              const roomPage = Math.min(Math.max(1, roomPageByLake[lake.id] || 1), Math.max(1, Math.ceil(roomCount / ROOMS_PAGE_SIZE)));
              const roomStartIndex = (roomPage - 1) * ROOMS_PAGE_SIZE;
              const paginatedRooms = allRooms.slice(roomStartIndex, roomStartIndex + ROOMS_PAGE_SIZE);
              const roomTotalPages = Math.max(1, Math.ceil(roomCount / ROOMS_PAGE_SIZE));
              const photoCount = photosByLake[lake.id]?.length || 0;
              const blockedCount = blockedDatesByLake[lake.id]?.length || 0;
              const ownerReservations = reservationsByLake[lake.id] || [];
              const pendingReservationCount = ownerReservations.filter((item) => item.status === "pending").length;
              const activeReservationFilter = reservationFilterByLake[lake.id] || "pending";
              const filteredOwnerReservations = activeReservationFilter === "all"
                ? ownerReservations
                : ownerReservations.filter((item) => item.status === activeReservationFilter);
              const selectedAvailabilityDate = spotAvailabilityDateByLake[lake.id] || "";
              const spotAvailability = spotAvailabilityByLake[lake.id] || null;
              const roomModalOpen = Boolean(roomModalByLake[lake.id]);
              const roomDraft = roomDraftByLake[lake.id] || DEFAULT_ROOM_FORM;
              const roomBulkDraft = roomBulkDraftByLake[lake.id] || DEFAULT_ROOM_BULK_FORM;
              const sortedSpots = [...(spotsByLake[lake.id] || [])].sort(
                (a, b) => Number(a.spot_number) - Number(b.spot_number)
              );
              const spotTotalPages = Math.max(1, Math.ceil(sortedSpots.length / SPOTS_PAGE_SIZE));
              const spotPage = Math.min(spotPageByLake[lake.id] || 1, spotTotalPages);
              const lakeEarnings = earningsByLake[lake.id] || {};
              const currentMonth = lakeEarnings.current_month || {};
              const monthlyReports = Array.isArray(lakeEarnings.monthly_reports) ? lakeEarnings.monthly_reports : [];
              const billingTransactions = Array.isArray(lakeEarnings.transactions) ? lakeEarnings.transactions : [];
              const monthlyReportTotalPages = Math.max(1, Math.ceil(monthlyReports.length / MONTHLY_REPORTS_PAGE_SIZE));
              const monthlyReportPage = Math.min(monthlyReportPageByLake[lake.id] || 1, monthlyReportTotalPages);
              const visibleMonthlyReports = monthlyReports.slice(
                (monthlyReportPage - 1) * MONTHLY_REPORTS_PAGE_SIZE,
                monthlyReportPage * MONTHLY_REPORTS_PAGE_SIZE
              );
              const billingTransactionTotalPages = Math.max(1, Math.ceil(billingTransactions.length / BILLING_TRANSACTIONS_PAGE_SIZE));
              const billingTransactionPage = Math.min(billingTransactionPageByLake[lake.id] || 1, billingTransactionTotalPages);
              const visibleBillingTransactions = billingTransactions.slice(
                (billingTransactionPage - 1) * BILLING_TRANSACTIONS_PAGE_SIZE,
                billingTransactionPage * BILLING_TRANSACTIONS_PAGE_SIZE
              );
              const payoutStatus = ownerBilling?.connect_ready ? "Connected" : (ownerBilling?.stripe_connected_account_id ? "Restricted" : "Not set up");
              const visibleSpots = sortedSpots.slice(
                (spotPage - 1) * SPOTS_PAGE_SIZE,
                spotPage * SPOTS_PAGE_SIZE
              );

              return (
                <article key={lake.id} className={styles.lakeCard}>
                  <div className={styles.lakeHeader}>
                    <div className={styles.lakeHeaderMain}>
                      <div className={styles.titleRow}>
                        <h3 className={styles.lakeTitle}>{lake.name}</h3>
                        <span className={styles.modeBadge}>{getLakeModeLabel(lake)}</span>
                        {lake.allows_night_fishing ? (
                          <span className={styles.successBadge}>Нощен риболов</span>
                        ) : null}
                        {lake.has_housing ? (
                          <span className={styles.warningBadge}>Настаняване</span>
                        ) : null}
                      </div>

                      <div className={styles.metaText}>
                        {lake.type || "Няма тип"} · {formatCurrency(lake.price_per_day || 0)} на ден · резервен капацитет {lake.capacity || 1}
                      </div>
                    </div>

                    <div className={styles.headerMetrics}>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Места</span>
                        <span className={styles.metricValue}>{spotCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Стаи</span>
                        <span className={styles.metricValue}>{roomCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Снимки</span>
                        <span className={styles.metricValue}>{photoCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Чакащи</span>
                        <span className={styles.metricValue}>{pendingReservationCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Блокирани</span>
                        <span className={styles.metricValue}>{blockedCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.tabBar}>
                    {TAB_ITEMS.filter((tab) => lake.has_housing || tab.key !== "rooms").map(
                      (tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={
                            activeTab === tab.key ? styles.tabButtonActive : styles.tabButton
                          }
                          onClick={() =>
                            setActiveTabByLake((prev) => ({ ...prev, [lake.id]: tab.key }))
                          }
                        >
                          <span>{tab.label}</span>
                          {tab.key === "reservations" && pendingReservationCount ? (
                            <span className={styles.tabBadge}>{pendingReservationCount > 99 ? "99+" : pendingReservationCount}</span>
                          ) : null}
                        </button>
                      )
                    )}
                  </div>

                  <div className={styles.tabPanelIntro}>{getTabDescription(activeTab)}</div>

                  {!hasOwnerPro ? (
                    <div className={styles.ownerProNotice}>
                      <div>
                        <strong>Модел на комисиона</strong>
                        <span> Собствениците не плащат месечен абонамент. Онлайн плащанията изискват завършена Stripe настройка за изплащания.</span>
                      </div>
                      <button type="button" onClick={goToOwnerBilling}>Надгради</button>
                    </div>
                  ) : null}

                  <div className={styles.lakeSections}>
                    {activeTab === "overview" ? (
                      <>
                        {!hasOwnerPro ? (
                          <SectionCard
                            title="Owner business tools"
                            subtitle="Тези инструменти използват модел с комисиона вместо абонамент за собственика."
                          >
                            <div className={styles.ownerProLockGrid}>
                              {renderOwnerProLock({
                                title: "Revenue Analytics",
                                message: "Unlock revenue charts, reservation insights, and an earnings dashboard for this lake.",
                                bullets: ["Revenue charts", "Reservation insights", "Earnings dashboard"],
                                compact: true,
                              })}
                              {renderOwnerProLock({
                                title: "Online paid bookings",
                                message: "Prepare this lake for Stripe-powered paid reservations and future automatic payment splitting.",
                                bullets: ["Online payment flow", "Payment status tracking", "Future platform commission support"],
                                compact: true,
                              })}
                            </div>
                          </SectionCard>
                        ) : (
                          <SectionCard
                            title="Owner business tools"
                            subtitle="Инструментите за собственика са активни за този водоем."
                          >
                            <div className={styles.ownerProActiveGrid}>
                              <div className={styles.ownerProActiveTile}>
                                <FaChartLine />
                                <div>
                                  <strong>Анализите на приходите са активни</strong>
                                  <span>Таблата за резервации и приходи са готови за следващия етап с плащания.</span>
                                </div>
                              </div>
                              <div className={styles.ownerProActiveTile}>
                                <FaMoneyBillWave />
                                <div>
                                  <strong>Основата за платени резервации е активна</strong>
                                  <span>Този водоем може да използва Stripe плащане за резервации след завършване на настройката за изплащания.</span>
                                </div>
                              </div>
                            </div>
                          </SectionCard>
                        )}

                        <SectionCard
                          title="Booking settings"
                          subtitle="Основни настройки за резервации, нощен риболов и настаняване."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={savingId === lake.id}
                              onClick={() => handleSaveLake(lake)}
                            >
                              {savingId === lake.id ? "Запазване..." : "Запази changes"}
                            </button>
                          }
                        >
                          <div className={styles.settingsGrid}>
                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.is_private)}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "is_private", event.target.checked)
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Частен водоем</div>
                                <div className={styles.settingText}>
                                  Restrict the lake as a private managed location.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.is_reservable)}
                                onChange={(event) =>
                                  updateLocalLake(
                                    lake.id,
                                    "is_reservable",
                                    event.target.checked
                                  )
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Приема резервации</div>
                                <div className={styles.settingText}>
                                  Allow users to submit booking requests.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.allows_night_fishing)}
                                onChange={(event) =>
                                  updateLocalLake(
                                    lake.id,
                                    "allows_night_fishing",
                                    event.target.checked
                                  )
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Нощен риболов</div>
                                <div className={styles.settingText}>
                                  Reveal a separate night fishing price only when enabled.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.has_housing)}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "has_housing", event.target.checked)
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Настаняване / стаи</div>
                                <div className={styles.settingText}>
                                  Включва настаняване и отделен раздел за стаи.
                                </div>
                              </div>
                            </label>
                          </div>

                          {lake.allows_night_fishing ? (
                            <div className={styles.revealCard}>
                              <div className={styles.revealTitle}>Цена за нощен риболов</div>
                              <div className={styles.formGrid}>
                                <LabeledInput
                                  label="Цена за нощен риболов (€)"
                                  hint="Required when night fishing is enabled."
                                >
                                  <input
                                    className={styles.input}
                                    type="text"
                                    inputMode="decimal"
                                    value={lake.night_fishing_price ?? 0}
                                    onChange={(event) =>
                                      updateLocalLake(
                                        lake.id,
                                        "night_fishing_price",
                                        parseMoneyInput(event.target.value)
                                      )
                                    }
                                  />
                                </LabeledInput>
                              </div>
                            </div>
                          ) : null}
                        </SectionCard>

                        <SectionCard
                          title="Lake overview"
                          subtitle="Основна публична информация и резервни ценови настройки."
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Lake name">
                              <input
                                className={styles.input}
                                type="text"
                                value={lake.name || ""}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "name", event.target.value)
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Type">
                              <input
                                className={styles.input}
                                type="text"
                                value={lake.type || ""}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "type", event.target.value)
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Базова цена на ден (€)">
                              <input
                                className={styles.input}
                                type="text"
                                inputMode="decimal"
                                value={lake.price_per_day ?? 0}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "price_per_day", parseMoneyInput(event.target.value))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Резервен капацитет">
                              <input
                                className={styles.input}
                                type="number"
                                min="1"
                                step="1"
                                value={lake.capacity ?? 1}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "capacity", event.target.value)
                                }
                              />
                            </LabeledInput>
                          </div>

                          <div className={styles.formStack}>
                            <LabeledInput label="Description">
                              <textarea
                                className={styles.textarea}
                                rows={5}
                                value={lake.description || ""}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "description", event.target.value)
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Availability notes">
                              <textarea
                                className={styles.textarea}
                                rows={3}
                                value={lake.availability_notes || ""}
                                onChange={(event) =>
                                  updateLocalLake(
                                    lake.id,
                                    "availability_notes",
                                    event.target.value
                                  )
                                }
                              />
                            </LabeledInput>
                          </div>
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "reservations" ? (
                      <>
                        {!hasOwnerPro ? (
                          renderOwnerProLock({
                            title: "Online reservation payments",
                            message: "Owners can review manual requests. Online paid reservations require completed Stripe payout setup.",
                            bullets: ["Paid reservation checkout", "Payout preparation", "Revenue tracking"],
                          })
                        ) : null}

                        <SectionCard
                          title="Заявки за резервации"
                          subtitle="Одобряване, отказване или връщане на заявки за резервация в изчакване. При завършена Stripe настройка одобрението може да доведе до онлайн плащане от потребителя."
                        >
                          <div className={styles.filterRow}>
                            {OWNER_RESERVATION_FILTERS.map((filter) => (
                              <button
                                key={filter}
                                type="button"
                                className={
                                  activeReservationFilter === filter
                                    ? styles.filterButtonActive
                                    : styles.filterButton
                                }
                                onClick={() =>
                                  setReservationFilterByLake((prev) => ({
                                    ...prev,
                                    [lake.id]: filter,
                                  }))
                                }
                              >
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </button>
                            ))}
                          </div>

                          {!filteredOwnerReservations.length ? (
                            <div className={styles.emptyState}>Няма резервации с този статус.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {filteredOwnerReservations.map((reservation) => (
                                <div key={reservation.id} className={styles.itemCardCompact} style={{ alignItems: "flex-start" }}>
                                  <div className={styles.ownerReservationDetails}>
                                    <div className={styles.itemTitle}>{reservation.lake_name || lake.name}</div>
                                    <div className={styles.metaText}>
                                      Потребител: {reservation.full_name || "Неизвестен"}{reservation.email ? ` (${reservation.email})` : ""}
                                    </div>
                                    <div className={styles.metaText}>
                                      Stay: {formatDate(reservation.arrival_date || reservation.start_date)} → {formatDate(reservation.departure_date || reservation.end_date)}
                                    </div>
                                    <div className={styles.ownerReservationBadges}>
                                      <span className={styles.mutedBadge}>Създадена: {formatDateTime(reservation.created_at)}</span>
                                      <ReservedSpotsBadge reservation={reservation} />
                                      <span className={styles.mutedBadge}>Дни за риболов: {(reservation.fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Нощен риболов: {(reservation.night_fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Стаи: {(reservation.room_names || []).length ? reservation.room_names.join(", ") : "Няма"}</span>
                                      <span className={styles.mutedBadge}>Общо: {formatCurrency(reservation.total_amount || 0)}</span>
                                      <span className={styles.mutedBadge}>Плащане: {getReservationPaymentLabel(reservation)}</span>
                                      <span className={styles.mutedBadge}>Комисиона на платформата: {formatCurrency(reservation.platform_fee_amount || 0)}</span>
                                      <span className={styles.mutedBadge}>Сума за собственика: {formatCurrency(reservation.owner_amount || 0)}</span>
                                    </div>
                                    <div className={styles.metaText} style={{ marginTop: "10px" }}>
                                      Notes: {reservation.notes || "No notes"}
                                    </div>
                                  </div>

                                  <div className={styles.ownerReservationActions}>
                                    <span className={
                                      reservation.status === "approved"
                                        ? styles.successBadge
                                        : reservation.status === "pending" || reservation.status === "approved_waiting_payment"
                                          ? styles.warningBadge
                                          : styles.mutedBadge
                                    }>
                                      {String(reservation.status || "pending").toUpperCase()}
                                    </span>
                                    {isReservationPast(reservation) ? (
                                      <span className={styles.mutedBadge}>Минала резервация</span>
                                    ) : (
                                      <div className={styles.ownerReservationButtonRow}>
                                        <button
                                          type="button"
                                          className={styles.secondaryButton}
                                          disabled={busyLakeId === lake.id}
                                          onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "approved")}
                                        >
                                          "Approve / request payment"
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.dangerButton}
                                          disabled={busyLakeId === lake.id}
                                          onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "rejected")}
                                        >
                                          Reject
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.filterButton}
                                          disabled={busyLakeId === lake.id}
                                          onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "pending")}
                                        >
                                          Mark pending
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {roomCount > ROOMS_PAGE_SIZE ? (
                            <Pagination
                              currentPage={roomPage}
                              totalPages={roomTotalPages}
                              totalItems={roomCount}
                              startIndex={roomStartIndex}
                              endIndex={Math.min(roomStartIndex + ROOMS_PAGE_SIZE, roomCount)}
                              onPageChange={(page) =>
                                setRoomPageByLake((prev) => ({
                                  ...prev,
                                  [lake.id]: Math.min(Math.max(1, page), roomTotalPages),
                                }))
                              }
                            />
                          ) : null}
                        </SectionCard>

                        <SectionCard
                          title="Наличност на местата по дата"
                          subtitle="Изберете дата, за да видите кои номерирани места са свободни, чакащи, одобрени, блокирани или неактивни."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={!selectedAvailabilityDate || busyLakeId === lake.id}
                              onClick={() => handleLoadSpotAvailability(lake.id, selectedAvailabilityDate)}
                            >
                              Обнови
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Дата за проверка">
                              <DatePicker
                                value={selectedAvailabilityDate}
                                onChange={(nextValue) => handleLoadSpotAvailability(lake.id, nextValue)}
                              />
                            </LabeledInput>
                          </div>

                          {!selectedAvailabilityDate ? (
                            <div className={styles.emptyState}>Изберете дата, за да проверите наличността на местата.</div>
                          ) : !spotAvailability ? (
                            <div className={styles.emptyState}>Все още няма заредена наличност за тази дата.</div>
                          ) : (
                            <>
                              {spotAvailability.blocked ? (
                                <div className={styles.emptyState} style={{ marginBottom: "12px" }}>
                                  Тази дата е блокирана{spotAvailability.blocked.reason ? `: ${spotAvailability.blocked.reason}` : "."}
                                </div>
                              ) : null}
                              <div className={styles.spotGrid}>
                                {(spotAvailability.spots || []).map((spot) => {
                                  const status = String(spot.status || "free");
                                  const badgeClass = status === "free"
                                    ? styles.successBadge
                                    : status === "pending"
                                      ? styles.warningBadge
                                      : styles.mutedBadge;
                                  return (
                                    <div key={spot.id} className={styles.spotCard}>
                                      <div className={styles.spotCardHeader}>
                                        <div>
                                          <div className={styles.itemTitle}>Място {spot.spot_number}</div>
                                          <div className={styles.metaText}>
                                            {spot.user_name ? `${spot.user_name}${spot.user_email ? ` (${spot.user_email})` : ""}` : status === "free" ? "Available" : status}
                                          </div>
                                        </div>
                                        <span className={badgeClass}>{status.toUpperCase()}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {Array.isArray(spotAvailability.capacity_reservations) && spotAvailability.capacity_reservations.length ? (
                                <div className={styles.emptyState} style={{ marginTop: "12px" }}>
                                  Има {spotAvailability.capacity_reservations.length} резервации по капацитет без избрани конкретни места за тази дата.
                                </div>
                              ) : null}
                            </>
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "spots" ? (
                      <>
                        <SectionCard
                          title="Настройки на местата"
                          subtitle="Задайте желания брой риболовни места и обновете генерирания списък."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleGenerateSpots(lake)}
                            >
                              {busyLakeId === lake.id ? "Обновяване..." : "Генерирай / обнови местата"}
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Желан брой места">
                              <input
                                className={styles.input}
                                type="number"
                                min="0"
                                step="1"
                                value={lake.spots_count ?? 0}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "spots_count", event.target.value)
                                }
                              />
                            </LabeledInput>
                          </div>
                        </SectionCard>

                        <SectionCard
                          title="Генерирани места"
                          subtitle="Активирайте или деактивирайте отделните места, създадени за този водоем."
                        >
                          {!spotsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма генерирани места.</div>
                          ) : (
                            <>
                              <div className={styles.spotGrid}>
                                {visibleSpots.map((spot) => (
                                  <div key={spot.id} className={styles.spotCard}>
                                    <div className={styles.spotCardHeader}>
                                      <div>
                                        <div className={styles.itemTitle}>Място {spot.spot_number}</div>
                                        <div className={styles.metaText}>
                                          {spot.is_active ? "Видимо и резервируемо" : "Скрито или недостъпно"}
                                        </div>
                                      </div>
                                      <span
                                        className={
                                          spot.is_active ? styles.successBadge : styles.mutedBadge
                                        }
                                      >
                                        {spot.is_active ? "Активно" : "Неактивно"}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={
                                        spot.is_active ? styles.dangerButton : styles.secondaryButton
                                      }
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleToggleSpotActive(lake.id, spot)}
                                    >
                                      {spot.is_active ? "Деактивирай" : "Активирай"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {spotTotalPages > 1 ? (
                                <Pagination
                                  currentPage={spotPage}
                                  totalPages={spotTotalPages}
                                  totalItems={sortedSpots.length}
                                  startIndex={(spotPage - 1) * SPOTS_PAGE_SIZE}
                                  endIndex={Math.min(spotPage * SPOTS_PAGE_SIZE, sortedSpots.length)}
                                  onPageChange={(nextPage) =>
                                    setSpotPageByLake((prev) => ({
                                      ...prev,
                                      [lake.id]: nextPage,
                                    }))
                                  }
                                />
                              ) : null}
                            </>
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "rooms" && lake.has_housing ? (
                      <>
                        <SectionCard
                          title="Настаняване"
                          subtitle="Създаване и управление на вили, бунгала или други типове стаи за гости."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => openCreateRoomModal(lake.id)}
                            >
                              + Добави стаи
                            </button>
                          }
                        >
                          {!roomsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма добавени стаи.</div>
                          ) : (
                            <div className={styles.roomsTableWrap}>
                              <table className={styles.roomsTable}>
                                <thead>
                                  <tr>
                                    <th>Тип / Име</th>
                                    <th>Капацитет</th>
                                    <th>Цена / Нощувка</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedRooms.map((room) => (
                                    <tr key={room.id}>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="text"
                                          value={room.name || ""}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "name",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="number"
                                          min="1"
                                          step="1"
                                          value={room.capacity ?? 1}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "capacity",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={room.price_per_night ?? 0}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "price_per_night",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <label className={styles.checkboxLabel}>
                                          <input
                                            type="checkbox"
                                            checked={Boolean(room.is_active)}
                                            onChange={(event) =>
                                              updateNestedItem(
                                                setRoomsByLake,
                                                lake.id,
                                                room.id,
                                                "is_active",
                                                event.target.checked
                                              )
                                            }
                                          />
                                          <span>{room.is_active ? "Активно" : "Неактивно"}</span>
                                        </label>
                                      </td>
                                      <td>
                                        <div className={styles.headerActions}>
                                          <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleSaveRoom(lake.id, room)}
                                          >
                                            Запази
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.dangerButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleDeleteRoom(lake.id, room.id)}
                                          >
                                            Изтрий
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {roomCount > ROOMS_PAGE_SIZE ? (
                            <Pagination
                              currentPage={roomPage}
                              totalPages={roomTotalPages}
                              totalItems={roomCount}
                              startIndex={roomStartIndex}
                              endIndex={Math.min(roomStartIndex + ROOMS_PAGE_SIZE, roomCount)}
                              onPageChange={(page) =>
                                setRoomPageByLake((prev) => ({
                                  ...prev,
                                  [lake.id]: Math.min(Math.max(1, page), roomTotalPages),
                                }))
                              }
                            />
                          ) : null}
                        </SectionCard>

                        {roomModalOpen ? (
                          <div className={styles.modalBackdrop}>
                            <div className={styles.modalCard}>
                              <div className={styles.modalHeader}>
                                <div>
                                  <h4 className={styles.subsectionTitle}>Добави нова стая</h4>
                                  <div className={styles.sectionSubtitle}>
                                    Добавете една стая или създайте много стаи наведнъж с еднакъв капацитет и цена.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.filterButton}
                                  onClick={() => closeRoomModal(lake.id)}
                                >
                                  Затвори
                                </button>
                              </div>

                              <div className={styles.roomCreateGrid}>
                                <div className={styles.roomCreateCard}>
                                <h5 className={styles.editorTitle}>Добавяне на много стаи</h5>
                                <div className={styles.sectionSubtitle}>
                                  Бързо създаване на последователни стаи с еднакъв капацитет и цена. След това всяка стая може да се редактира отделно.
                                </div>
                                <div className={styles.formGrid}>
                                  <LabeledInput label="Префикс">
                                    <input
                                      className={styles.input}
                                      type="text"
                                      value={roomBulkDraft.prefix || ""}
                                      onChange={(event) => handleRoomBulkDraftChange(lake.id, "prefix", event.target.value)}
                                    />
                                  </LabeledInput>
                                  <LabeledInput label="От номер">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={roomBulkDraft.from ?? 1}
                                      onChange={(event) => handleRoomBulkDraftChange(lake.id, "from", event.target.value)}
                                    />
                                  </LabeledInput>
                                  <LabeledInput label="До номер">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={roomBulkDraft.to ?? 5}
                                      onChange={(event) => handleRoomBulkDraftChange(lake.id, "to", event.target.value)}
                                    />
                                  </LabeledInput>
                                  <LabeledInput label="Капацитет">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={roomBulkDraft.capacity ?? 2}
                                      onChange={(event) => handleRoomBulkDraftChange(lake.id, "capacity", event.target.value)}
                                    />
                                  </LabeledInput>
                                  <LabeledInput label="Цена за нощувка (€)">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={roomBulkDraft.price_per_night ?? 0}
                                      onChange={(event) => handleRoomBulkDraftChange(lake.id, "price_per_night", event.target.value)}
                                    />
                                  </LabeledInput>
                                </div>
                                <div className={styles.modalActions}>
                                  <button
                                    type="button"
                                    className={styles.primaryButton}
                                    disabled={busyLakeId === lake.id}
                                    onClick={() => handleCreateRoomBatch(lake.id)}
                                  >
                                    {busyLakeId === lake.id ? "Добавяне..." : "Създай стаите"}
                                  </button>
                                </div>
                                </div>

                                <div className={styles.roomCreateCard}>
                                <h5 className={styles.editorTitle}>Добавяне на една стая</h5>
                                <div className={styles.formGrid}>
                                  <LabeledInput label="Име на стаята">
                                    <input
                                      className={styles.input}
                                      type="text"
                                      value={roomDraft.name || ""}
                                      onChange={(event) =>
                                        handleRoomDraftChange(lake.id, "name", event.target.value)
                                      }
                                    />
                                  </LabeledInput>

                                  <LabeledInput label="Капацитет">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={roomDraft.capacity ?? 1}
                                      onChange={(event) =>
                                        handleRoomDraftChange(
                                          lake.id,
                                          "capacity",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </LabeledInput>

                                  <LabeledInput label="Цена за нощувка (€)">
                                    <input
                                      className={styles.input}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={roomDraft.price_per_night ?? 0}
                                      onChange={(event) =>
                                        handleRoomDraftChange(
                                          lake.id,
                                          "price_per_night",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </LabeledInput>
                                </div>

                                <div className={styles.modalActions}>
                                  <button
                                    type="button"
                                    className={styles.filterButton}
                                    onClick={() => closeRoomModal(lake.id)}
                                  >
                                    Откажи
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.primaryButton}
                                    disabled={busyLakeId === lake.id}
                                    onClick={() => handleCreateRoom(lake.id)}
                                  >
                                    {busyLakeId === lake.id ? "Запазване..." : "Създай стая"}
                                  </button>
                                </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {activeTab === "gallery" ? (
                      <SectionCard
                        title="Галерия на водоема"
                        subtitle="Качете снимки от собственика, които могат да се показват в публичната страница на водоема."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Качи нови снимки</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleUploadPhoto(lake.id)}
                            >
                              Качи избраните снимки
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Файлове със снимки" hint="Можете да изберете една или няколко снимки наведнъж.">
                              <input
                                className={styles.input}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jpg"
                                multiple
                                onChange={(event) => {
                                  const files = Array.from(event.target.files || []);
                                  setPhotoFilesByLake((prev) => ({ ...prev, [lake.id]: files }));
                                  setPhotoCaptionsByLake((prev) => ({ ...prev, [lake.id]: files.map(() => "") }));
                                  setPhotoPreviewsByLake((prev) => ({
                                    ...prev,
                                    [lake.id]: files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
                                  }));
                                }}
                              />
                            </LabeledInput>
                          </div>

                          {(photoPreviewsByLake[lake.id] || []).length ? (
                            <div className={styles.itemList}>
                              {(photoPreviewsByLake[lake.id] || []).map((preview, index) => (
                                <div key={`${preview.name}-${index}`} className={styles.photoManagerCard}>
                                  <ZoomableImage src={preview.url} alt={preview.name} imageClassName={styles.photoThumb} />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>{preview.name}</div>
                                    <div className={styles.metaText}>Готово за качване</div>
                                    <input
                                      className={styles.input}
                                      type="text"
                                      placeholder="Описание по избор"
                                      value={(photoCaptionsByLake[lake.id] || [])[index] || ""}
                                      onChange={(event) =>
                                        setPhotoCaptionsByLake((prev) => {
                                          const current = [...(prev[lake.id] || [])];
                                          current[index] = event.target.value;
                                          return { ...prev, [lake.id]: current };
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {!photosByLake[lake.id]?.length ? (
                          <div className={styles.emptyState}>Все още няма качени снимки в галерията на водоема.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {photosByLake[lake.id].map((photo) => (
                              <div key={photo.id} className={styles.photoManagerCard}>
                                <ZoomableImage
                                  src={getUploadUrl(photo.image_url)}
                                  alt={photo.caption || "Снимка на водоема"}
                                  imageClassName={styles.photoThumb}
                                />
                                <div className={styles.photoManagerBody}>
                                  <div className={styles.blockedDate}>
                                    {photo.caption || "Снимка без заглавие"}
                                  </div>
                                  <div className={styles.metaText}>
                                    Качено на {formatDate(photo.created_at)}
                                  </div>
                                  <div className={styles.photoUrl}>{photo.image_url}</div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeletePhoto(lake.id, photo.id)}
                                >
                                  Премахни
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.galleryDivider} />

                        <SectionCard
                          title="Потребителски снимки на улови"
                          subtitle="Тези снимки идват от риболовните дневници на потребителите. Те са отделени от снимките, качени от собственика."
                        >
                          {!catchPhotosByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма потребителски снимки на улови за този водоем.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {catchPhotosByLake[lake.id].map((item) => (
                                <div key={item.id} className={styles.photoManagerCard}>
                                  <ZoomableImage
                                    src={getUploadUrl(item.image_url)}
                                    alt={item.species || "Потребителски улов"}
                                    imageClassName={styles.photoThumb}
                                  />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>
                                      {item.species || "Снимка на потребителски улов"}
                                    </div>
                                    <div className={styles.metaText}>
                                      От {item.full_name || "Неизвестен потребител"} · {item.weight_kg ?? "-"} кг · {formatDate(item.catch_time || item.created_at)}
                                    </div>
                                    {item.notes ? <div className={styles.photoUrl}>{item.notes}</div> : null}
                                  </div>
                                  <div className={styles.photoActions}>
                                    <button
                                      type="button"
                                      className={styles.filterButton}
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleReportCatchUser(lake.id, item)}
                                    >
                                      Докладвай потребител
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.dangerButton}
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleDeleteCatchPhoto(lake.id, item.id)}
                                    >
                                      Премахни снимката
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </SectionCard>
                      </SectionCard>
                    ) : null}


                    {activeTab === "billing" ? (
                      <SectionCard
                        title="Плащания и приходи"
                        subtitle="Приходите са част от управлението на собственика, защото идват от резервации, места, нощен риболов и стаи."
                        actions={
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={busyLakeId === lake.id}
                            onClick={() => handleRefreshLakeEarnings(lake.id)}
                          >
                            {busyLakeId === lake.id ? "Обновяване..." : "Обнови приходите"}
                          </button>
                        }
                      >
                        <div className={styles.earningsSummaryGrid}>
                          <div className={styles.earningsCard}>
                            <span>Общи приходи на собственика</span>
                            <strong>{formatCurrency(ownerRevenue?.total_earnings || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Чакащ Stripe баланс</span>
                            <strong>{formatCurrency(ownerRevenue?.pending_balance || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Наличен Stripe баланс</span>
                            <strong>{formatCurrency(ownerRevenue?.available_balance || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Следващо плащане</span>
                            <strong className={styles.earningsSmallText}>{ownerRevenue?.estimated_next_payout || "Седмични автоматични изплащания"}</strong>
                          </div>
                        </div>

                        <div className={styles.earningsSummaryGrid}>
                          <div className={styles.earningsCard}>
                            <span>Приходи този месец</span>
                            <strong>{formatCurrency(currentMonth.total_revenue || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Комисиона на платформата</span>
                            <strong>{formatCurrency(currentMonth.platform_fee || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Нетни приходи на собственика</span>
                            <strong>{formatCurrency(currentMonth.owner_earnings || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Платени резервации</span>
                            <strong>{currentMonth.paid_reservations || 0}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Чакащи изплащания</span>
                            <strong>{formatCurrency(currentMonth.pending_payouts || 0)}</strong>
                          </div>
                        </div>

                        <div className={styles.billingSubgrid}>
                          <div className={styles.editorCard}>
                            <div className={styles.editorHeader}>
                              <h5 className={styles.editorTitle}>Настройка за Stripe изплащания</h5>
                              <span className={ownerBilling?.connect_ready ? styles.successBadge : styles.warningBadge}>
                                {payoutStatus}
                              </span>
                            </div>
                            <div className={styles.metaText}>
                              Account: {ownerBilling?.stripe_connected_account_id || "not created"} · Onboarding: {ownerBilling?.connect_onboarding_status || "not_started"}
                            </div>
                            <div className={styles.billingActions}>
                              {!hasOwnerPro ? (
                                <button type="button" className={styles.primaryButton} onClick={() => handleOwnerConnect("upgrade")}>
                                  Set up payouts
                                </button>
                              ) : (
                                <>
                                  <button type="button" className={styles.primaryButton} onClick={() => handleOwnerConnect("connect")}>
                                    <FaPlug /> {ownerBilling?.stripe_connected_account_id ? "Continue payouts" : "Set up payouts"}
                                  </button>
                                  <button type="button" className={styles.filterButton} onClick={() => handleOwnerConnect("refresh")}>
                                    Обнови status
                                  </button>
                                  {ownerBilling?.subscription_status !== "inactive" ? (
                                    <button type="button" className={styles.filterButton} onClick={() => handleOwnerConnect("portal")}>
                                      Manage payouts <FaExternalLinkAlt />
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>

                          <div className={styles.editorCard}>
                            <div className={styles.editorHeader}>
                              <h5 className={styles.editorTitle}>Месечни отчети</h5>
                            </div>
                            {!monthlyReports.length ? (
                              <div className={styles.emptyState}>Все още няма платени месечни отчети.</div>
                            ) : (
                              <>
                                <div className={styles.reportList}>
                                  {visibleMonthlyReports.map((report) => (
                                    <div key={report.month_key} className={styles.reportRow}>
                                      <strong>Отчет за {report.month_label}</strong>
                                      <span>{formatCurrency(report.owner_earnings || 0)} приходи за собственика</span>
                                    </div>
                                  ))}
                                </div>
                                {monthlyReportTotalPages > 1 ? (
                                  <Pagination
                                    currentPage={monthlyReportPage}
                                    totalPages={monthlyReportTotalPages}
                                    totalItems={monthlyReports.length}
                                    startIndex={(monthlyReportPage - 1) * MONTHLY_REPORTS_PAGE_SIZE}
                                    endIndex={Math.min(monthlyReportPage * MONTHLY_REPORTS_PAGE_SIZE, monthlyReports.length)}
                                    onPageChange={(nextPage) =>
                                      setMonthlyReportPageByLake((prev) => ({
                                        ...prev,
                                        [lake.id]: nextPage,
                                      }))
                                    }
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

                        {!billingTransactions.length ? (
                          <div className={styles.emptyState}>Все още няма транзакции от платени резервации.</div>
                        ) : (
                          <>
                            <div className={styles.earningsTableWrap}>
                              <table className={styles.earningsTable}>
                                <thead>
                                  <tr>
                                    <th>Дата</th>
                                    <th>Водоем</th>
                                    <th>Клиент</th>
                                    <th>Обща сума</th>
                                    <th>Комисиона на платформата</th>
                                    <th>Сума за собственика</th>
                                    <th>Статус</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleBillingTransactions.map((item) => (
                                    <tr key={item.id}>
                                      <td>{formatDate(item.paid_at || item.created_at)}</td>
                                      <td>{item.lake_name || lake.name}</td>
                                      <td>{item.customer_name || item.customer_email || "Клиент"}</td>
                                      <td>{formatCurrency(item.total_amount || 0)}</td>
                                      <td>{formatCurrency(item.platform_fee_amount || 0)}</td>
                                      <td>{formatCurrency(item.owner_amount || 0)}</td>
                                      <td><span className={styles.successBadge}>{getReservationPaymentLabel(item) || "платено"}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {billingTransactionTotalPages > 1 ? (
                              <Pagination
                                currentPage={billingTransactionPage}
                                totalPages={billingTransactionTotalPages}
                                totalItems={billingTransactions.length}
                                startIndex={(billingTransactionPage - 1) * BILLING_TRANSACTIONS_PAGE_SIZE}
                                endIndex={Math.min(billingTransactionPage * BILLING_TRANSACTIONS_PAGE_SIZE, billingTransactions.length)}
                                onPageChange={(nextPage) =>
                                  setBillingTransactionPageByLake((prev) => ({
                                    ...prev,
                                    [lake.id]: nextPage,
                                  }))
                                }
                              />
                            ) : null}
                          </>
                        )}
                      </SectionCard>
                    ) : null}

                    {activeTab === "blocked" ? (
                      <SectionCard
                        title="Блокирани дати"
                        subtitle="Изключете поддръжка, частни събития и недостъпни дати от процеса на резервация."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Добави блокиран период</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleAddBlockedDate(lake.id)}
                            >
                              {busyLakeId === lake.id ? "Запазване..." : "Добави блокиран период"}
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Начална дата">
                              <DatePicker
                                value={blockedDateInputs[lake.id] || ""}
                                onChange={(nextValue) =>
                                  setBlockedDateInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: nextValue,
                                  }))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Крайна дата">
                              <DatePicker
                                value={blockedEndDateInputs[lake.id] || ""}
                                min={blockedDateInputs[lake.id] || undefined}
                                onChange={(nextValue) =>
                                  setBlockedEndDateInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: nextValue,
                                  }))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Причина">
                              <input
                                className={styles.input}
                                type="text"
                                value={blockedReasonInputs[lake.id] || ""}
                                onChange={(event) =>
                                  setBlockedReasonInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: event.target.value,
                                  }))
                                }
                                placeholder="Поддръжка, събитие, частна резервация..."
                              />
                            </LabeledInput>
                          </div>
                        </div>

                        {!blockedDatesByLake[lake.id]?.length ? (
                          <div className={styles.emptyState}>Все още няма добавени блокирани дати.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {blockedDatesByLake[lake.id].map((item) => (
                              <div key={item.id} className={styles.itemCardCompact}>
                                <div>
                                  <div className={styles.blockedDate}>
                                    {formatDate(item.blocked_date)}
                                  </div>
                                  <div className={styles.metaText}>
                                    {item.reason || "Няма добавена причина"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeleteBlockedDate(lake.id, item.id)}
                                >
                                  Премахни
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </SectionCard>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
