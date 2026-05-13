import React, { useEffect, useState } from "react";
import { FaUserCog } from "react-icons/fa";
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
import { updateReservationStatus } from "../api/reservationsApi";
import { notifyError, notifySuccess } from "../ui/toast";
import { formatCurrency } from "../utils/formatCurrency";
import DatePicker from "../components/ui/DatePicker";
import styles from "./OwnerPanel.module.css";

const DEFAULT_ROOM_FORM = {
  name: "",
  capacity: 1,
  price_per_night: 0,
  is_active: true,
  sort_order: 0,
};

const SPOTS_PAGE_SIZE = 12;

const getUploadUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:/i.test(imageUrl) || imageUrl.startsWith("blob:")) return imageUrl;
  return `http://localhost:5000/uploads/${imageUrl}`;
};

const parseMoneyInput = (value) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

const TAB_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "reservations", label: "Reservations" },
  { key: "spots", label: "Fishing Spots" },
  { key: "rooms", label: "Housing / Rooms" },
  { key: "gallery", label: "Gallery & Media" },
  { key: "blocked", label: "Blocked Dates" },
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
  if (numbers.length) return `${numbers.length} selected`;
  const count = Number(item?.requested_spots || item?.people_count || 1);
  return `${count} requested`;
};

function ReservedSpotsBadge({ reservation }) {
  const numbers = getReservedSpotNumbers(reservation);

  return (
    <span className={`${styles.mutedBadge} ${styles.reservationSpotBadge}`}>
      <span>Reserved spots: {formatReservedSpots(reservation)}</span>
      {numbers.length ? (
        <details className={styles.reservationSpotDetails}>
          <summary>View spot numbers</summary>
          <span className={styles.reservationSpotList}>
            {numbers.map((value) => (
              <span key={value} className={styles.reservationSpotPill}>
                Spot {value}
              </span>
            ))}
          </span>
        </details>
      ) : null}
    </span>
  );
}

const OWNER_RESERVATION_FILTERS = ["pending", "approved", "rejected", "cancelled", "all"];

const getLakeModeLabel = (lake) => {
  if (lake.is_private && lake.is_reservable) return "Private & reservable";
  if (lake.is_private) return "Private";
  if (lake.is_reservable) return "Reservable";
  return "Public";
};

const getTabDescription = (tabKey) => {
  if (tabKey === "overview") {
    return "Manage the main lake settings, booking rules, and pricing from one focused place.";
  }
  if (tabKey === "reservations") {
    return "Review booking requests and check spot availability for selected dates.";
  }
  if (tabKey === "spots") {
    return "Create and manage individual fishing spots for this lake.";
  }
  if (tabKey === "rooms") {
    return "Create accommodation options like cabins or bungalows for guests.";
  }
  if (tabKey === "gallery") {
    return "Upload and manage the media shown for this lake.";
  }
  return "Prevent reservations on dates reserved for maintenance, events, or private use.";
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
  const [spotPageByLake, setSpotPageByLake] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [busyLakeId, setBusyLakeId] = useState("");

  const loadOwnerPanel = async () => {
    try {
      setLoading(true);
      const owned = await getOwnerLakes();
      const normalizedLakes = Array.isArray(owned) ? owned : [];
      setLakes(normalizedLakes);

      const [blockedEntries, spotEntries, roomEntries, photoEntries, catchPhotoEntries, reservationEntries] = await Promise.all([
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
      ]);

      setBlockedDatesByLake(Object.fromEntries(blockedEntries));
      setSpotsByLake(Object.fromEntries(spotEntries));
      setRoomsByLake(Object.fromEntries(roomEntries));
      setPhotosByLake(Object.fromEntries(photoEntries));
      setCatchPhotosByLake(Object.fromEntries(catchPhotoEntries));
      setReservationsByLake(Object.fromEntries(reservationEntries));
      setNewRoomByLake(
        Object.fromEntries(
          normalizedLakes.map((lake) => [lake.id, { ...DEFAULT_ROOM_FORM }])
        )
      );
      setActiveTabByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, "overview"]))
      );
      setSpotPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setReservationFilterByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, "pending"]))
      );
    } catch (error) {
      notifyError(error, "Failed to load owner lakes");
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
      notifyError(null, "Add a valid night fishing price before saving");
      return;
    }

    try {
      setSavingId(lake.id);
      const updatedLake = await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      setLakes((prev) =>
        prev.map((item) => (item.id === lake.id ? { ...item, ...updatedLake } : item))
      );
      notifySuccess("Lake settings updated");
    } catch (error) {
      notifyError(error, "Failed to update lake settings");
    } finally {
      setSavingId("");
    }
  };

  const handleAddBlockedDate = async (lakeId) => {
    const start_date = blockedDateInputs[lakeId] || "";
    const end_date = blockedEndDateInputs[lakeId] || start_date || "";
    const reason = blockedReasonInputs[lakeId] || "";

    if (!start_date || !end_date) {
      notifyError(null, "Choose a start and end date first");
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
      notifySuccess("Blocked date range saved");
    } catch (error) {
      notifyError(error, "Failed to save blocked date range");
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
      notifySuccess("Blocked date removed");
    } catch (error) {
      notifyError(error, "Failed to delete blocked date");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleGenerateSpots = async (lake) => {
    const spotsCount = Number(lake.spots_count || 0);

    if (!Number.isInteger(spotsCount) || spotsCount < 0) {
      notifyError(null, "Spots count must be 0 or more");
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

      notifySuccess("Fishing spots updated");
    } catch (error) {
      notifyError(error, "Failed to generate fishing spots");
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

      notifySuccess("Spot updated");
    } catch (error) {
      notifyError(error, "Failed to update spot");
    } finally {
      setBusyLakeId("");
    }
  };

  const openCreateRoomModal = (lakeId) => {
    setRoomDraftByLake((prev) => ({
      ...prev,
      [lakeId]: { ...(newRoomByLake[lakeId] || DEFAULT_ROOM_FORM) },
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

  const handleCreateRoom = async (lakeId) => {
    const payload = roomDraftByLake[lakeId] || newRoomByLake[lakeId] || DEFAULT_ROOM_FORM;

    if (!String(payload.name || "").trim()) {
      notifyError(null, "Add a room name first");
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
      notifySuccess("Room added");
    } catch (error) {
      notifyError(error, "Failed to create room");
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
      notifySuccess("Room updated");
    } catch (error) {
      notifyError(error, "Failed to update room");
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
      notifySuccess("Room removed");
    } catch (error) {
      notifyError(error, "Failed to delete room");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleUploadPhoto = async (lakeId) => {
    const files = photoFilesByLake[lakeId] || [];

    if (!files.length) {
      notifyError(null, "Choose at least one image first");
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
        notifySuccess(`${uploadedItems.length} uploaded, ${failedItems.length} failed`);
      } else {
        notifySuccess(uploadedItems.length > 1 ? "Lake photos uploaded" : "Lake photo uploaded");
      }
    } catch (error) {
      notifyError(error, "Failed to upload photo");
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
      notifySuccess("Photo removed");
    } catch (error) {
      notifyError(error, "Failed to delete photo");
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
      notifySuccess("User catch photo removed");
    } catch (error) {
      notifyError(error, "Failed to remove user catch photo");
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
      notifySuccess("Reservation updated");
      await refreshOwnerLakeReservations(lakeId);
      const selectedDate = spotAvailabilityDateByLake[lakeId];
      if (selectedDate) {
        const availability = await getOwnerLakeSpotAvailability(lakeId, selectedDate).catch(() => null);
        setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: availability }));
      }
    } catch (error) {
      notifyError(error, "Failed to update reservation");
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
      notifyError(error, "Failed to load spot availability");
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: null }));
    } finally {
      setBusyLakeId("");
    }
  };

  const handleReportCatchUser = async (lakeId, catchItem) => {
    const reason = window.prompt("Why do you want to report this user/catch photo?");
    if (!reason || !reason.trim()) return;

    try {
      setBusyLakeId(lakeId);
      await reportOwnerLakeCatch(lakeId, catchItem.id, { reason: reason.trim() });
      notifySuccess("Report sent to admin");
    } catch (error) {
      notifyError(error, "Failed to report user");
    } finally {
      setBusyLakeId("");
    }
  };


  if (loading) {
    return <div className={styles.loading}>Loading owner panel...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            <FaUserCog />
            <span>Owner Panel</span>
          </div>
          <h2 className={styles.heroTitle}>Owner Panel</h2>
        </div>

        {!lakes.length ? (
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>No approved lakes yet</h3>
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
              const roomCount = roomsByLake[lake.id]?.length || 0;
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
              const sortedSpots = [...(spotsByLake[lake.id] || [])].sort(
                (a, b) => Number(a.spot_number) - Number(b.spot_number)
              );
              const spotTotalPages = Math.max(1, Math.ceil(sortedSpots.length / SPOTS_PAGE_SIZE));
              const spotPage = Math.min(spotPageByLake[lake.id] || 1, spotTotalPages);
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
                          <span className={styles.successBadge}>Night fishing</span>
                        ) : null}
                        {lake.has_housing ? (
                          <span className={styles.warningBadge}>Housing</span>
                        ) : null}
                      </div>

                      <div className={styles.metaText}>
                        {lake.type || "No type"} · {formatCurrency(lake.price_per_day || 0)} per
                        day · fallback capacity {lake.capacity || 1}
                      </div>
                    </div>

                    <div className={styles.headerMetrics}>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Spots</span>
                        <span className={styles.metricValue}>{spotCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Rooms</span>
                        <span className={styles.metricValue}>{roomCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Photos</span>
                        <span className={styles.metricValue}>{photoCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Pending</span>
                        <span className={styles.metricValue}>{pendingReservationCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Blocked</span>
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

                  <div className={styles.lakeSections}>
                    {activeTab === "overview" ? (
                      <>
                        <SectionCard
                          title="Booking settings"
                          subtitle="High-impact controls for reservations, night fishing, and housing."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={savingId === lake.id}
                              onClick={() => handleSaveLake(lake)}
                            >
                              {savingId === lake.id ? "Saving..." : "Save changes"}
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
                                <div className={styles.settingTitle}>Private lake</div>
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
                                <div className={styles.settingTitle}>Accept reservations</div>
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
                                <div className={styles.settingTitle}>Night fishing</div>
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
                                <div className={styles.settingTitle}>Housing / rooms</div>
                                <div className={styles.settingText}>
                                  Enable accommodation and the dedicated rooms tab.
                                </div>
                              </div>
                            </label>
                          </div>

                          {lake.allows_night_fishing ? (
                            <div className={styles.revealCard}>
                              <div className={styles.revealTitle}>Night fishing price</div>
                              <div className={styles.formGrid}>
                                <LabeledInput
                                  label="Night fishing price (€)"
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
                          subtitle="Core public information and fallback pricing details."
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

                            <LabeledInput label="Base price per day (€)">
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

                            <LabeledInput label="Fallback capacity">
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
                        <SectionCard
                          title="Reservation requests"
                          subtitle="Approve, reject, or return booking requests to pending for this lake."
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
                            <div className={styles.emptyState}>No reservations match this status.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {filteredOwnerReservations.map((reservation) => (
                                <div key={reservation.id} className={styles.itemCardCompact} style={{ alignItems: "flex-start" }}>
                                  <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                                    <div className={styles.itemTitle}>{reservation.lake_name || lake.name}</div>
                                    <div className={styles.metaText}>
                                      User: {reservation.full_name || "Unknown"}{reservation.email ? ` (${reservation.email})` : ""}
                                    </div>
                                    <div className={styles.metaText}>
                                      Stay: {formatDate(reservation.arrival_date || reservation.start_date)} → {formatDate(reservation.departure_date || reservation.end_date)}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                                      <span className={styles.mutedBadge}>Created: {formatDateTime(reservation.created_at)}</span>
                                      <ReservedSpotsBadge reservation={reservation} />
                                      <span className={styles.mutedBadge}>Fishing days: {(reservation.fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Night fishing: {(reservation.night_fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Rooms: {(reservation.room_names || []).length ? reservation.room_names.join(", ") : "None"}</span>
                                      <span className={styles.mutedBadge}>Total: {formatCurrency(reservation.total_amount || 0)}</span>
                                    </div>
                                    <div className={styles.metaText} style={{ marginTop: "10px" }}>
                                      Notes: {reservation.notes || "No notes"}
                                    </div>
                                  </div>

                                  <div style={{ display: "grid", gap: "8px", justifyItems: "end" }}>
                                    <span className={
                                      reservation.status === "approved"
                                        ? styles.successBadge
                                        : reservation.status === "pending"
                                          ? styles.warningBadge
                                          : styles.mutedBadge
                                    }>
                                      {String(reservation.status || "pending").toUpperCase()}
                                    </span>
                                    {isReservationPast(reservation) ? (
                                      <span className={styles.mutedBadge}>Past reservation</span>
                                    ) : (
                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        <button
                                          type="button"
                                          className={styles.secondaryButton}
                                          disabled={busyLakeId === lake.id}
                                          onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "approved")}
                                        >
                                          Approve
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
                        </SectionCard>

                        <SectionCard
                          title="Spot availability by date"
                          subtitle="Choose a date to see which numbered spots are free, pending, approved, blocked, or inactive."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={!selectedAvailabilityDate || busyLakeId === lake.id}
                              onClick={() => handleLoadSpotAvailability(lake.id, selectedAvailabilityDate)}
                            >
                              Refresh
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Availability date">
                              <DatePicker
                                value={selectedAvailabilityDate}
                                onChange={(nextValue) => handleLoadSpotAvailability(lake.id, nextValue)}
                              />
                            </LabeledInput>
                          </div>

                          {!selectedAvailabilityDate ? (
                            <div className={styles.emptyState}>Choose a date to inspect spot availability.</div>
                          ) : !spotAvailability ? (
                            <div className={styles.emptyState}>No availability loaded for this date yet.</div>
                          ) : (
                            <>
                              {spotAvailability.blocked ? (
                                <div className={styles.emptyState} style={{ marginBottom: "12px" }}>
                                  This date is blocked{spotAvailability.blocked.reason ? `: ${spotAvailability.blocked.reason}` : "."}
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
                                          <div className={styles.itemTitle}>Spot {spot.spot_number}</div>
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
                                  There are {spotAvailability.capacity_reservations.length} capacity-based reservation(s) without exact spot numbers on this date.
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
                          title="Spot configuration"
                          subtitle="Set the desired number of fishing spots and sync the generated list."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleGenerateSpots(lake)}
                            >
                              {busyLakeId === lake.id ? "Updating..." : "Generate / Update spots"}
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Desired number of spots">
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
                          title="Generated spots"
                          subtitle="Activate or deactivate individual spot entries created for this lake."
                        >
                          {!spotsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>No spots generated yet.</div>
                          ) : (
                            <>
                              <div className={styles.spotGrid}>
                                {visibleSpots.map((spot) => (
                                  <div key={spot.id} className={styles.spotCard}>
                                    <div className={styles.spotCardHeader}>
                                      <div>
                                        <div className={styles.itemTitle}>Spot {spot.spot_number}</div>
                                        <div className={styles.metaText}>
                                          {spot.is_active ? "Visible and bookable" : "Hidden or unavailable"}
                                        </div>
                                      </div>
                                      <span
                                        className={
                                          spot.is_active ? styles.successBadge : styles.mutedBadge
                                        }
                                      >
                                        {spot.is_active ? "Active" : "Inactive"}
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
                                      {spot.is_active ? "Deactivate" : "Activate"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {spotTotalPages > 1 ? (
                                <div className={styles.paginationBar}>
                                  <span>
                                    Page {spotPage} of {spotTotalPages} · {sortedSpots.length} spots
                                  </span>
                                  <div className={styles.paginationActions}>
                                    <button
                                      type="button"
                                      className={styles.filterButton}
                                      disabled={spotPage <= 1}
                                      onClick={() =>
                                        setSpotPageByLake((prev) => ({
                                          ...prev,
                                          [lake.id]: Math.max(1, spotPage - 1),
                                        }))
                                      }
                                    >
                                      Previous
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.primaryButton}
                                      disabled={spotPage >= spotTotalPages}
                                      onClick={() =>
                                        setSpotPageByLake((prev) => ({
                                          ...prev,
                                          [lake.id]: Math.min(spotTotalPages, spotPage + 1),
                                        }))
                                      }
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "rooms" && lake.has_housing ? (
                      <>
                        <SectionCard
                          title="Accommodation"
                          subtitle="Create and manage cabins, bungalows, or other room types for guests."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => openCreateRoomModal(lake.id)}
                            >
                              + Add new room / cabin
                            </button>
                          }
                        >
                          {!roomsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>No rooms added yet.</div>
                          ) : (
                            <div className={styles.roomsTableWrap}>
                              <table className={styles.roomsTable}>
                                <thead>
                                  <tr>
                                    <th>Type / Name</th>
                                    <th>Capacity</th>
                                    <th>Price / Night</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {roomsByLake[lake.id].map((room) => (
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
                                          <span>{room.is_active ? "Active" : "Inactive"}</span>
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
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.dangerButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleDeleteRoom(lake.id, room.id)}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </SectionCard>

                        {roomModalOpen ? (
                          <div className={styles.modalBackdrop}>
                            <div className={styles.modalCard}>
                              <div className={styles.modalHeader}>
                                <div>
                                  <h4 className={styles.subsectionTitle}>Add new room</h4>
                                  <div className={styles.sectionSubtitle}>
                                    Create a housing option without taking space in the main layout.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.filterButton}
                                  onClick={() => closeRoomModal(lake.id)}
                                >
                                  Close
                                </button>
                              </div>

                              <div className={styles.formGrid}>
                                <LabeledInput label="Room name">
                                  <input
                                    className={styles.input}
                                    type="text"
                                    value={roomDraft.name || ""}
                                    onChange={(event) =>
                                      handleRoomDraftChange(lake.id, "name", event.target.value)
                                    }
                                  />
                                </LabeledInput>

                                <LabeledInput label="Capacity">
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

                                <LabeledInput label="Price per night (€)">
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
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className={styles.primaryButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleCreateRoom(lake.id)}
                                >
                                  {busyLakeId === lake.id ? "Saving..." : "Create room"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {activeTab === "gallery" ? (
                      <SectionCard
                        title="Lake gallery"
                        subtitle="Upload owner-managed photos that can be shown in the public lake view."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Upload new photos</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleUploadPhoto(lake.id)}
                            >
                              Upload selected photos
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Image files" hint="You can select one or many images at once.">
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
                                  <img className={styles.photoThumb} src={preview.url} alt={preview.name} />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>{preview.name}</div>
                                    <div className={styles.metaText}>Ready to upload</div>
                                    <input
                                      className={styles.input}
                                      type="text"
                                      placeholder="Optional caption"
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
                          <div className={styles.emptyState}>No lake gallery photos uploaded yet.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {photosByLake[lake.id].map((photo) => (
                              <div key={photo.id} className={styles.photoManagerCard}>
                                <img
                                  className={styles.photoThumb}
                                  src={getUploadUrl(photo.image_url)}
                                  alt={photo.caption || "Lake photo"}
                                />
                                <div className={styles.photoManagerBody}>
                                  <div className={styles.blockedDate}>
                                    {photo.caption || "Untitled photo"}
                                  </div>
                                  <div className={styles.metaText}>
                                    Uploaded {formatDate(photo.created_at)}
                                  </div>
                                  <div className={styles.photoUrl}>{photo.image_url}</div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeletePhoto(lake.id, photo.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.galleryDivider} />

                        <SectionCard
                          title="User catch photos"
                          subtitle="These come from users' catch logs. They are separated from owner lake photos."
                        >
                          {!catchPhotosByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>No user catch photos for this lake yet.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {catchPhotosByLake[lake.id].map((item) => (
                                <div key={item.id} className={styles.photoManagerCard}>
                                  <img
                                    className={styles.photoThumb}
                                    src={getUploadUrl(item.image_url)}
                                    alt={item.species || "User catch"}
                                  />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>
                                      {item.species || "User catch photo"}
                                    </div>
                                    <div className={styles.metaText}>
                                      By {item.full_name || "Unknown user"} · {item.weight_kg ?? "-"} kg · {formatDate(item.catch_time || item.created_at)}
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
                                      Report user
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.dangerButton}
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleDeleteCatchPhoto(lake.id, item.id)}
                                    >
                                      Remove photo
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </SectionCard>
                      </SectionCard>
                    ) : null}

                    {activeTab === "blocked" ? (
                      <SectionCard
                        title="Blocked dates"
                        subtitle="Keep maintenance, private events, and unavailable dates out of reservation flow."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Add blocked date range</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleAddBlockedDate(lake.id)}
                            >
                              {busyLakeId === lake.id ? "Saving..." : "Add blocked range"}
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Start date">
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

                            <LabeledInput label="End date">
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

                            <LabeledInput label="Reason">
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
                                placeholder="Maintenance, event, private booking..."
                              />
                            </LabeledInput>
                          </div>
                        </div>

                        {!blockedDatesByLake[lake.id]?.length ? (
                          <div className={styles.emptyState}>No blocked dates added yet.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {blockedDatesByLake[lake.id].map((item) => (
                              <div key={item.id} className={styles.itemCardCompact}>
                                <div>
                                  <div className={styles.blockedDate}>
                                    {formatDate(item.blocked_date)}
                                  </div>
                                  <div className={styles.metaText}>
                                    {item.reason || "No reason added"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeleteBlockedDate(lake.id, item.id)}
                                >
                                  Remove
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
