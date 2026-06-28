import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DatePicker from "../components/ui/DatePicker";
import ZoomableImage from "../components/ui/ZoomableImage";
import PremiumLockedCard from "../components/common/PremiumLockedCard";
import { GeoJSON, MapContainer, TileLayer, Marker } from "react-leaflet";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChartLine,
  FaCloudSun,
  FaFish,
  FaImages,
  FaLock,
  FaMapMarkerAlt,
  FaStar,
  FaTemperatureHigh,
  FaWind,
  FaWater,
} from "react-icons/fa";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LakeDetails.module.css";
import { notifyError, notifySuccess } from "../ui/toast";
import { createLakeIcon, focusLakeOnMap, getDisplayDescription, getLakeGeometry, truncate } from "../features/fishing-map/fishingMap.utils";
import {
  createAlert,
  createFavorite,
  deleteFavorite,
  getAlertStatus,
  updateAlert,
} from "../api/alertsApi";
import {
  createReservation,
  estimateReservation,
  startReservationPayment,
} from "../api/reservationsApi";
import {
  createWaterBodyReview,
  deleteMyWaterBodyReview,
  getWaterBodyBlockedDates,
  getWaterBodyBookingOptions,
  getWaterBodyAvailability,
  getWaterBodyUnavailableDates,
  getWaterBodyById,
  getWaterBodyCatches,
  getWaterBodyForecast,
  getWaterBodyWeeklyForecast,
  getWaterBodyPhotos,
  getWaterBodyReviews,
  getWaterBodyReviewsSummary,
  getWaterBodySpeciesSummary,
} from "../api/lakeDetailsApi";
import { formatCurrency } from "../utils/formatCurrency";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const DEFAULT_ALERT_STATE = {
  enabled: false,
  favorite: false,
  notification_frequency: "daily",
};

const DEFAULT_REVIEWS_SUMMARY = {
  reviews_count: 0,
  average_rating: null,
};

const formatForecastNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

const formatAverageRating = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "Все още няма оценка";
  }

  return numericValue.toFixed(2);
};

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "18px",
  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
};

const sectionTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  margin: "0 0 14px 0",
  fontSize: "18px",
  fontWeight: 800,
  color: "#0f172a",
};


const formatForecastDay = (value) => {
  if (!value) return "Неизвестно";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bg-BG", { weekday: "short", month: "short", day: "numeric" });
};


const formatDateTime = (value) => {
  if (!value) return "Неизвестно време";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Неизвестно време";
  return date.toLocaleString("bg-BG");
};

const formatDate = (value) => {
  if (!value) return "Неизвестна дата";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bg-BG");
};


const translateForecastText = (value) => {
  if (!value) return "";
  const replacements = [
    [/Excellent fishing conditions expected\.?/gi, "Очакват се отлични условия за риболов."],
    [/Very good fishing conditions expected\.?/gi, "Очакват се много добри условия за риболов."],
    [/Good fishing conditions expected\.?/gi, "Очакват се добри условия за риболов."],
    [/Fair fishing conditions expected\.?/gi, "Очакват се средни условия за риболов."],
    [/Average fishing conditions expected\.?/gi, "Очакват се средни условия за риболов."],
    [/Weak fishing conditions expected\.?/gi, "Очакват се слаби условия за риболов."],
    [/Poor fishing conditions expected\.?/gi, "Очакват се лоши условия за риболов."],
    [/Temperature is in a strong fishing range/gi, "Температурата е в благоприятен диапазон за риболов"],
    [/Temperature is usable but not ideal/gi, "Температурата е приемлива, но не е идеална"],
    [/Very cold water conditions may reduce activity/gi, "Много студената вода може да намали активността"],
    [/High temperature may reduce fish activity during the day/gi, "Високата температура може да намали активността на рибата през деня"],
    [/Air pressure is stable and favorable/gi, "Атмосферното налягане е стабилно и благоприятно"],
    [/Pressure is outside the preferred range/gi, "Налягането е извън предпочитания диапазон"],
    [/Pressure is acceptable/gi, "Налягането е приемливо"],
    [/Low wind should make fishing conditions easier/gi, "Слабият вятър прави условията за риболов по-лесни"],
    [/Strong wind may make fishing harder/gi, "Силният вятър може да затрудни риболова"],
    [/Wind is moderate/gi, "Вятърът е умерен"],
    [/Moon phase is favorable/gi, "Лунната фаза е благоприятна"],
    [/Moon phase is less favorable/gi, "Лунната фаза е по-неблагоприятна"],
    [/Moon phase is neutral/gi, "Лунната фаза е неутрална"],
    [/waning moon/gi, "намаляваща луна"],
    [/waxing moon/gi, "нарастваща луна"],
    [/full moon/gi, "пълнолуние"],
    [/new moon/gi, "новолуние"],
    [/Score combines ML prediction with weather and moon factors\.?/gi, "Оценката се изчислява чрез прогнозния модул на база времето и лунната фаза."],
    [/ML model was unavailable, so a heuristic forecast was used\.?/gi, "Основният прогнозен модул не беше наличен, затова беше използвана резервна формула."],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value));
};

const DEFAULT_PAGE_SIZES = {
  species: 3,
  catches: 2,
  photos: 10,
  reviews: 4,
  rooms: 4,
};

const getTotalPages = (items, pageSize) => {
  const safeSize = Math.max(1, Number(pageSize) || 1);
  return Math.max(1, Math.ceil((Array.isArray(items) ? items.length : 0) / safeSize));
};

const paginateItems = (items, page, pageSize) => {
  const safeItems = Array.isArray(items) ? items : [];
  const totalPages = getTotalPages(safeItems, pageSize);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    items: safeItems.slice(startIndex, startIndex + pageSize),
    totalPages,
    safePage,
  };
};

function CatchSkeletonList() {
  return (
    <div className={styles.catchSkeletonList} aria-label="Зареждане на последните улови">
      {[0, 1].map((item) => (
        <div key={item} className={styles.catchSkeletonCard}>
          <div className={styles.skeletonLineStrong} />
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLineShort} />
          <div className={styles.skeletonImage} />
        </div>
      ))}
    </div>
  );
}

function PaginationControls({ page, totalPages, onChange, itemLabel }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginTop: "14px",
      }}
    >
      <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
        Страница {page} от {totalPages}
        {itemLabel ? ` · ${itemLabel}` : ""}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          style={{
            border: "1px solid #d1d5db",
            background: "white",
            color: "#334155",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          Предишна
        </button>

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          style={{
            border: "none",
            background: "#0d6efd",
            color: "white",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: page >= totalPages ? 0.6 : 1,
          }}
        >
          Следваща
        </button>
      </div>
    </div>
  );
}

function LakeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lake, setLake] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState("");
  const [weeklyForecast, setWeeklyForecast] = useState([]);
  const [weeklyForecastError, setWeeklyForecastError] = useState("");
  const [weeklyForecastLoading, setWeeklyForecastLoading] = useState(false);
  const [showWeeklyForecast, setShowWeeklyForecast] = useState(false);
  const [selectedWeeklyForecastDate, setSelectedWeeklyForecastDate] = useState("");
  const [catches, setCatches] = useState([]);
  const [catchesLoading, setCatchesLoading] = useState(false);
  const [speciesSummary, setSpeciesSummary] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState(DEFAULT_REVIEWS_SUMMARY);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [speciesPage, setSpeciesPage] = useState(1);
  const [catchesPage, setCatchesPage] = useState(1);
  const [photosPage, setPhotosPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [roomsPage, setRoomsPage] = useState(1);

  const [alertState, setAlertState] = useState(DEFAULT_ALERT_STATE);
  const [savingAlertState, setSavingAlertState] = useState(false);

  const [bookingOptions, setBookingOptions] = useState({ lake: null, rooms: [], spots: [] });
  const [availability, setAvailability] = useState(null);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [selectedSpotIds, setSelectedSpotIds] = useState([]);
  const [isSpotPickerOpen, setIsSpotPickerOpen] = useState(false);
  const [fishingDates, setFishingDates] = useState([]);
  const [nightFishingRequested, setNightFishingRequested] = useState(false);
  const [nightFishingDates, setNightFishingDates] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [roomGuestCount, setRoomGuestCount] = useState(1);
  const [reservationNotes, setReservationNotes] = useState("");
  const [paymentPreference, setPaymentPreference] = useState("online");
  const [reservationQuote, setReservationQuote] = useState(null);
  const [reservationQuoteError, setReservationQuoteError] = useState("");
  const [savingReservation, setSavingReservation] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1000);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const lakeMapRef = useRef(null);
  const reservationRangeRef = useRef("");

  const getDateOffsetValue = (offsetDays) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };

  const loadReviews = async () => {
    try {
      const [reviewsData, reviewsSummaryData] = await Promise.all([
        getWaterBodyReviews(id),
        getWaterBodyReviewsSummary(id),
      ]);

      setReviews(reviewsData || []);
      setReviewsSummary(reviewsSummaryData || DEFAULT_REVIEWS_SUMMARY);
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на отзивите");
    }
  };


  useEffect(() => {
    let cancelled = false;

    const resetSecondaryLakeData = () => {
      setForecast(null);
      setForecastError("");
      setCatches([]);
      setCatchesLoading(false);
      setSpeciesSummary([]);
      setPhotos([]);
      setReviews([]);
      setReviewsSummary(DEFAULT_REVIEWS_SUMMARY);
      setAlertState(DEFAULT_ALERT_STATE);
      setBookingOptions({ lake: null, rooms: [], spots: [] });
      setBlockedDates([]);
      setUnavailableDates([]);
      setAvailability(null);
      setSelectedSpotIds([]);
      setIsSpotPickerOpen(false);
      setReservationQuote(null);
      setReservationQuoteError("");
    };

    const loadPrimaryLakeDetails = async () => {
      setLoading(true);
      resetSecondaryLakeData();

      try {
        const lakeData = await getWaterBodyById(id);
        if (cancelled) return;
        setLake(lakeData || null);
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setLake(null);
          notifyError(error, "Неуспешно зареждане на детайлите за водоема");
          setLoading(false);
        }
      }
    };

    loadPrimaryLakeDetails();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadSecondaryLakeDetails = async () => {
      if (!lake?.id) {
        return;
      }

      setCatchesLoading(true);

      const [
        forecastData,
        catchesData,
        speciesSummaryData,
        photosData,
        reviewsData,
        reviewsSummaryData,
        alertStatusData,
        bookingOptionsData,
        blockedDatesData,
      ] = await Promise.all([
        getWaterBodyForecast(id)
          .then((data) => ({ ok: true, data }))
          .catch((error) => ({ ok: false, error })),
        getWaterBodyCatches(id).catch(() => []),
        getWaterBodySpeciesSummary(id).catch(() => []),
        getWaterBodyPhotos(id).catch(() => []),
        getWaterBodyReviews(id).catch(() => []),
        getWaterBodyReviewsSummary(id).catch(() => DEFAULT_REVIEWS_SUMMARY),
        getAlertStatus(id).catch(() => DEFAULT_ALERT_STATE),
        getWaterBodyBookingOptions(id).catch(() => ({ lake: null, rooms: [], spots: [] })),
        getWaterBodyBlockedDates(id).catch(() => []),
      ]);

      if (cancelled) return;

      if (forecastData?.ok) {
        setForecast(forecastData.data || null);
        setForecastError("");
      } else {
        setForecast(null);
        const forecastErrorCode = forecastData?.error?.response?.data?.code;
        setForecastError(
          forecastErrorCode === "PREMIUM_REQUIRED"
            ? "Изисква се Премиум абонамент за подробната риболовна прогноза."
            : forecastData?.error?.response?.data?.error ||
              "Прогнозата временно не е достъпна. Опитай отново по-късно."
        );
      }
      setCatches(catchesData || []);
      setCatchesLoading(false);
      setSpeciesSummary(speciesSummaryData || []);
      setPhotos(photosData || []);
      setReviews(reviewsData || []);
      setReviewsSummary(reviewsSummaryData || DEFAULT_REVIEWS_SUMMARY);
      setAlertState(alertStatusData || DEFAULT_ALERT_STATE);
      setBookingOptions(bookingOptionsData || { lake: null, rooms: [], spots: [] });
      setBlockedDates(blockedDatesData || []);
    };

    loadSecondaryLakeDetails().catch((error) => {
      if (!cancelled) {
        console.warn("Failed to load secondary lake details", error);
        setCatchesLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, lake?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadUnavailableDates = async () => {
      if (!id || !lake?.is_reservable) {
        setUnavailableDates([]);
        return;
      }

      try {
        const data = await getWaterBodyUnavailableDates(id, {
          start_date: getDateOffsetValue(0),
          end_date: getDateOffsetValue(365),
        });

        if (!cancelled) {
          setUnavailableDates(data?.unavailable_dates || []);
        }
      } catch (_error) {
        if (!cancelled) setUnavailableDates([]);
      }
    };

    loadUnavailableDates();

    return () => {
      cancelled = true;
    };
  }, [id, lake?.is_reservable]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1000);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const selectedLakeMapIcon = useMemo(() => createLakeIcon(true), []);
  const lakeGeometry = useMemo(() => getLakeGeometry(lake), [lake]);

  useEffect(() => {
    if (!lakeMapRef.current || !lake) {
      return;
    }

    const timer = window.setTimeout(() => {
      focusLakeOnMap(lakeMapRef.current, lake, {
        maxZoom: 16,
        markerZoom: 15,
        paddingTopLeft: [36, 36],
        paddingBottomRight: [36, 36],
        duration: 0.9,
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [lake, lakeGeometry]);

  const lakeDescription = useMemo(() => getDisplayDescription(lake?.description), [lake]);
  const lakeDescriptionPreview = useMemo(() => truncate(lakeDescription, 155), [lakeDescription]);
  const lakeDescriptionCanExpand = lakeDescriptionPreview !== lakeDescription;

  const mapCenter = useMemo(() => {
    if (
      lake &&
      Number.isFinite(Number(lake.latitude)) &&
      Number.isFinite(Number(lake.longitude))
    ) {
      return [Number(lake.latitude), Number(lake.longitude)];
    }

    return [42.7339, 25.4858];
  }, [lake]);


  const bookingLake = useMemo(() => bookingOptions?.lake || null, [bookingOptions?.lake]);

  const onlinePaymentsAvailable = Boolean(bookingLake?.online_payments_available);
  const platformFeePercent = Number.isFinite(Number(bookingLake?.platform_fee_percent))
    ? Number(bookingLake.platform_fee_percent)
    : 10;

  const allowsNightFishing = useMemo(() => Boolean(
    lake?.allows_night_fishing ??
    lake?.allowsNightFishing ??
    bookingLake?.allows_night_fishing ??
    bookingLake?.allowsNightFishing
  ), [lake, bookingLake]);

  const nightFishingPrice = useMemo(() => Number(
    lake?.night_fishing_price ??
    lake?.nightFishingPrice ??
    bookingLake?.night_fishing_price ??
    bookingLake?.nightFishingPrice ??
    0
  ), [lake, bookingLake]);

  const configuredSpotCapacity = useMemo(() => {
    const value = Number(
      bookingLake?.spots_count ??
      bookingLake?.spotsCount ??
      lake?.spots_count ??
      lake?.spotsCount ??
      lake?.capacity ??
      1
    );
    return Math.max(1, Number.isFinite(value) ? value : 1);
  }, [bookingLake, lake]);

  const availableSpotCapacity = useMemo(() => {
    if (availability?.lake) {
      const value = Number(availability.lake.remaining_spot_capacity);
      return Math.max(0, Number.isFinite(value) ? value : 0);
    }

    return configuredSpotCapacity;
  }, [availability, configuredSpotCapacity]);

  const maxRequestableSpots = Math.max(0, availableSpotCapacity);
  const selectedSpotCount = selectedSpotIds.length;
  const isPremiumRequired = forecastError.toLowerCase().includes("premium");
  const goToBilling = () => navigate("/billing");


  const loadWeeklyForecast = async () => {
    if (!id || weeklyForecastLoading) return;

    if (showWeeklyForecast) {
      setShowWeeklyForecast(false);
      return;
    }

    setShowWeeklyForecast(true);

    if (weeklyForecast.length) {
      return;
    }

    try {
      setWeeklyForecastLoading(true);
      setWeeklyForecastError("");
      const data = await getWaterBodyWeeklyForecast(id);
      const safeData = Array.isArray(data) ? data.slice(0, 7) : [];
      setWeeklyForecast(safeData);
      setSelectedWeeklyForecastDate((current) => current || safeData[0]?.date || "");
    } catch (error) {
      const errorCode = error?.response?.data?.code;
      setWeeklyForecastError(
        errorCode === "PREMIUM_REQUIRED"
          ? "Изисква се Премиум абонамент за седмичната прогноза."
          : error?.response?.data?.error ||
              "Седмичната прогноза временно не е достъпна. Опитай отново по-късно."
      );
    } finally {
      setWeeklyForecastLoading(false);
    }
  };


  const paginatedSpecies = useMemo(
    () => paginateItems(speciesSummary, speciesPage, DEFAULT_PAGE_SIZES.species),
    [speciesSummary, speciesPage],
  );

  const paginatedCatches = useMemo(
    () => paginateItems(catches, catchesPage, DEFAULT_PAGE_SIZES.catches),
    [catches, catchesPage],
  );

  const paginatedPhotos = useMemo(
    () => paginateItems(photos, photosPage, DEFAULT_PAGE_SIZES.photos),
    [photos, photosPage],
  );

  const paginatedReviews = useMemo(
    () => paginateItems(reviews, reviewsPage, DEFAULT_PAGE_SIZES.reviews),
    [reviews, reviewsPage],
  );

  const roomCapacityOptions = useMemo(() => {
    const capacities = (bookingOptions?.rooms || [])
      .map((room) => Number(room.capacity || 1))
      .filter((capacity) => Number.isFinite(capacity) && capacity > 0);

    return Array.from(new Set(capacities)).sort((a, b) => a - b);
  }, [bookingOptions?.rooms]);

  const filteredRooms = useMemo(
    () => (bookingOptions?.rooms || []).filter((room) => Number(room.capacity || 1) >= roomGuestCount),
    [bookingOptions?.rooms, roomGuestCount],
  );

  const paginatedRooms = useMemo(
    () => paginateItems(filteredRooms, roomsPage, DEFAULT_PAGE_SIZES.rooms),
    [filteredRooms, roomsPage],
  );


  useEffect(() => {
    setSpeciesPage((prev) => Math.min(prev, paginatedSpecies.totalPages));
  }, [paginatedSpecies.totalPages]);

  useEffect(() => {
    setCatchesPage((prev) => Math.min(prev, paginatedCatches.totalPages));
  }, [paginatedCatches.totalPages]);

  useEffect(() => {
    setPhotosPage((prev) => Math.min(prev, paginatedPhotos.totalPages));
  }, [paginatedPhotos.totalPages]);

  useEffect(() => {
    setReviewsPage((prev) => Math.min(prev, paginatedReviews.totalPages));
  }, [paginatedReviews.totalPages]);

  useEffect(() => {
    setRoomsPage((prev) => Math.min(prev, paginatedRooms.totalPages));
  }, [paginatedRooms.totalPages]);

  useEffect(() => {
    setRoomsPage(1);
  }, [roomGuestCount, bookingOptions?.rooms]);

  useEffect(() => {
    if (!onlinePaymentsAvailable && paymentPreference === "online") {
      setPaymentPreference("on_arrival");
    }
  }, [onlinePaymentsAvailable, paymentPreference]);

  useEffect(() => {
    if (!roomCapacityOptions.length) {
      return;
    }

    if (!roomCapacityOptions.includes(Number(roomGuestCount))) {
      setRoomGuestCount(roomCapacityOptions[0]);
    }
  }, [roomCapacityOptions, roomGuestCount]);

  useEffect(() => {
    setSpeciesPage(1);
    setCatchesPage(1);
    setPhotosPage(1);
    setReviewsPage(1);
    setRoomsPage(1);
    setDescriptionExpanded(false);
  }, [id]);

  const submitReview = async (event) => {
    event.preventDefault();

    if (savingReview) {
      return;
    }

    const trimmedComment = reviewComment.trim();
    const normalizedRating = Number(reviewRating);

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      notifyError(null, "Оценката трябва да бъде между 1 и 5");
      return;
    }

    try {
      setSavingReview(true);

      await createWaterBodyReview(id, {
        rating: normalizedRating,
        comment: trimmedComment,
      });

      notifySuccess("Отзивът е запазен");
      setReviewComment("");
      setReviewRating(5);
      await loadReviews();
    } catch (error) {
      notifyError(error, "Неуспешно запазване на отзива");
    } finally {
      setSavingReview(false);
    }
  };

  const deleteMyReview = async () => {
    if (savingReview) {
      return;
    }

    if (!window.confirm("Сигурни ли сте, че искате да премахнете своя отзив?")) return;

    try {
      setSavingReview(true);
      await deleteMyWaterBodyReview(id);
      notifySuccess("Отзивът е изтрит");
      await loadReviews();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на отзива");
    } finally {
      setSavingReview(false);
    }
  };

  const saveAlertSettings = async (nextState, successMessage) => {
    if (alertState.enabled && !nextState.enabled && !window.confirm("Сигурни ли сте, че искате да изключите известията за този водоем?")) return;

    try {
      setSavingAlertState(true);

      const payload = {
        is_active: Boolean(nextState.enabled),
        is_favorite: Boolean(nextState.favorite),
        notification_frequency: nextState.notification_frequency || "daily",
      };

      if (payload.is_active) {
        await createAlert({
          water_body_id: id,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
        });
      } else if (alertState.enabled || alertState.favorite) {
        await updateAlert(id, {
          is_active: false,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
        });
      } else if (payload.is_favorite) {
        await createFavorite(id);
      }

      setAlertState(nextState);

      if (successMessage) {
        notifySuccess(successMessage);
      }
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на настройките за водоема");
    } finally {
      setSavingAlertState(false);
    }
  };

  const toggleFavoriteState = async () => {
    if (savingAlertState) {
      return;
    }

    try {
      setSavingAlertState(true);

      if (alertState.favorite) {
        if (!window.confirm("Сигурни ли сте, че искате да премахнете този водоем от любими?")) return;
        if (alertState.enabled) {
          await updateAlert(id, { is_favorite: false });
        } else {
          await deleteFavorite(id);
        }

        setAlertState((prev) => ({ ...prev, favorite: false }));
        notifySuccess("Премахнато от любими");
        return;
      }

      if (alertState.enabled) {
        await updateAlert(id, { is_favorite: true });
      } else {
        await createFavorite(id);
      }

      setAlertState((prev) => ({ ...prev, favorite: true }));
      notifySuccess("Добавено в любими");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на състоянието за любими");
    } finally {
      setSavingAlertState(false);
    }
  };


  const allowedFishingDates = useMemo(() => {
    if (!arrivalDate || !departureDate) return [];
    const dates = [];
    const cursor = new Date(`${arrivalDate}T00:00:00Z`);
    const final = new Date(`${departureDate}T00:00:00Z`);
    while (cursor <= final) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }, [arrivalDate, departureDate]);

  const defaultFishingDates = useMemo(() => {
    if (!arrivalDate || !departureDate) return [];
    if (arrivalDate === departureDate) return [arrivalDate];
    return allowedFishingDates.filter((date) => date !== departureDate);
  }, [arrivalDate, departureDate, allowedFishingDates]);

  const allowedNightDates = useMemo(() => {
    if (!arrivalDate || !departureDate) return [];
    const dates = [];
    const cursor = new Date(`${arrivalDate}T00:00:00Z`);
    const final = new Date(`${departureDate}T00:00:00Z`);
    if (final <= cursor) return [];
    final.setUTCDate(final.getUTCDate() - 1);
    while (cursor <= final) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }, [arrivalDate, departureDate]);

  const toggleDateSelection = (dateValue, setter) => {
    setter((prev) =>
      prev.includes(dateValue)
        ? prev.filter((item) => item !== dateValue)
        : [...prev, dateValue].sort()
    );
  };

  useEffect(() => {
    const rangeKey = `${arrivalDate || ""}|${departureDate || ""}`;

    if (!arrivalDate || !departureDate) {
      reservationRangeRef.current = rangeKey;
      setFishingDates([]);
      setNightFishingRequested(false);
      setNightFishingDates([]);
      setReservationQuote(null);
      return;
    }

    if (reservationRangeRef.current !== rangeKey) {
      reservationRangeRef.current = rangeKey;
      setFishingDates(defaultFishingDates);
      setNightFishingDates(nightFishingRequested && allowsNightFishing ? allowedNightDates : []);
      return;
    }

    setFishingDates((prev) => prev.filter((date) => allowedFishingDates.includes(date)));
    setNightFishingDates((prev) => nightFishingRequested && allowsNightFishing ? prev.filter((date) => allowedNightDates.includes(date)) : []);
  }, [arrivalDate, departureDate, allowedFishingDates, defaultFishingDates, allowedNightDates, nightFishingRequested, allowsNightFishing]);

  useEffect(() => {
    let cancelled = false;
    const loadAvailability = async () => {
      if (!arrivalDate || !departureDate) {
        setAvailability(null);
        return;
      }

      try {
        const data = await getWaterBodyAvailability(id, {
          start_date: arrivalDate,
          end_date: departureDate,
        });
        if (!cancelled) setAvailability(data || null);
      } catch (_error) {
        if (!cancelled) setAvailability(null);
      }
    };

    loadAvailability();
    return () => { cancelled = true; };
  }, [id, arrivalDate, departureDate]);

  useEffect(() => {
    const availableSpotIds = new Set((availability?.spots || []).filter((spot) => spot.is_available).map((spot) => String(spot.id)));
    if (!availableSpotIds.size) {
      setSelectedSpotIds([]);
      return;
    }
    setSelectedSpotIds((prev) => prev.filter((spotId) => availableSpotIds.has(String(spotId))));
  }, [availability]);

  useEffect(() => {
    if (!lake?.is_reservable) return;

    if (maxRequestableSpots <= 0) {
      setSelectedSpotIds([]);
      setIsSpotPickerOpen(false);
    } else {
      setSelectedSpotIds((prev) => prev.slice(0, maxRequestableSpots));
    }
  }, [lake?.is_reservable, maxRequestableSpots]);

  useEffect(() => {
    let cancelled = false;
    const loadEstimate = async () => {
      if (!arrivalDate || !departureDate || selectedSpotCount <= 0 || (!fishingDates.length && !nightFishingDates.length && !selectedRoomIds.length)) {
        setReservationQuote(null);
        setReservationQuoteError("");
        return;
      }
      try {
        const quote = await estimateReservation({
          water_body_id: id,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          fishing_dates: fishingDates,
          night_fishing_dates: nightFishingDates,
          room_ids: selectedRoomIds,
          spot_ids: selectedSpotIds,
          requested_spots: selectedSpotCount,
        });
        if (!cancelled) {
          setReservationQuote(quote);
          setReservationQuoteError("");
        }
      } catch (error) {
        if (!cancelled) {
          setReservationQuote(null);
          setReservationQuoteError(error?.response?.data?.error || "Неуспешно изчисляване на цената за резервация за избрания период.");
        }
      }
    };
    loadEstimate();
    return () => { cancelled = true; };
  }, [id, arrivalDate, departureDate, fishingDates, nightFishingDates, selectedRoomIds, selectedSpotIds, selectedSpotCount]);

  const submitReservation = async (event) => {
    event.preventDefault();

    if (savingReservation) return;
    if (!arrivalDate || !departureDate) {
      notifyError(null, "Моля, избери дати на пристигане и напускане");
      return;
    }
    if (!fishingDates.length && !nightFishingDates.length && !selectedRoomIds.length) {
      notifyError(null, "Избери поне един ден за риболов, нощен риболов или стая");
      return;
    }
    if (maxRequestableSpots <= 0) {
      notifyError(null, "Няма свободни риболовни места за избрания период");
      return;
    }
    if (selectedSpotCount <= 0) {
      notifyError(null, "Моля, избери поне едно риболовно място");
      return;
    }
    if (selectedSpotCount > maxRequestableSpots) {
      notifyError(null, `Само ${maxRequestableSpots} ${maxRequestableSpots === 1 ? "риболовно място е налично" : "риболовни места са налични"} за избрания период`);
      return;
    }

    try {
      setSavingReservation(true);
      const reservation = await createReservation({
        water_body_id: id,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        fishing_dates: fishingDates,
        night_fishing_dates: nightFishingDates,
        room_ids: selectedRoomIds,
        spot_ids: selectedSpotIds,
        requested_spots: selectedSpotCount,
        notes: reservationNotes.trim(),
        payment_method: paymentPreference,
      });

      if (paymentPreference === "online") {
        notifySuccess("Резервацията е създадена. Пренасочване към сигурно плащане...");
        const payment = await startReservationPayment(reservation.id);
        if (payment?.url) {
          window.location.href = payment.url;
          return;
        }
      }

      notifySuccess("Заявката за резервация е изпратена успешно");
      navigate("/reservations", { state: { reservationSubmitted: true } });
    } catch (error) {
      notifyError(error, "Неуспешно създаване на резервация");
    } finally {
      setSavingReservation(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "24px",
          background: "#f8fafc",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <div
          style={{
            maxWidth: "1300px",
            margin: "0 auto",
            color: "#475569",
            fontWeight: 600,
          }}
        >
          Зареждане на детайли...
        </div>
      </div>
    );
  }

  const selectedWeeklyForecast = weeklyForecast.find((day) => day.date === selectedWeeklyForecastDate) || weeklyForecast[0] || null;
  const displayedForecast = showWeeklyForecast && selectedWeeklyForecast ? selectedWeeklyForecast : forecast;
  const displayedForecastBreakdown = displayedForecast?.breakdown || {};
  const displayedForecastDateLabel = showWeeklyForecast && selectedWeeklyForecast?.date
    ? formatForecastDay(selectedWeeklyForecast.date)
    : "Днес";

  if (!lake) {
    return (
      <div
        style={{
          padding: "24px",
          background: "#f8fafc",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              border: "none",
              background: "#0d6efd",
              color: "white",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          >
            Назад към картата
          </button>
          <div style={cardStyle}>Водоемът не е намерен.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            border: "none",
            background: "#0d6efd",
            color: "white",
            borderRadius: "12px",
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: "18px",
            fontWeight: 700,
          }}
        >
          <FaArrowLeft />
          Назад към картата
        </button>

        <div
          style={{
            ...cardStyle,
            marginBottom: "20px",
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            border: "none",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              opacity: 0.92,
              marginBottom: "6px",
            }}
          >
            Детайли за водоема
          </div>

          <h1
            style={{
              margin: "0 0 8px 0",
              fontSize: "30px",
              fontWeight: 900,
            }}
          >
            {lake.name}
          </h1>

          <div
            style={{
              maxWidth: "820px",
              lineHeight: 1.6,
              fontSize: "15px",
              opacity: 0.98,
              whiteSpace: descriptionExpanded ? "normal" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {descriptionExpanded ? lakeDescription : lakeDescriptionPreview}
          </div>

          {lakeDescriptionCanExpand ? (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((value) => !value)}
              style={{
                marginTop: "8px",
                border: "none",
                background: "transparent",
                color: "white",
                padding: 0,
                cursor: "pointer",
                fontWeight: 800,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {descriptionExpanded ? "Покажи по-малко" : "Покажи повече"}
            </button>
          ) : null}

        </div>

        {lake.is_private && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h2 style={sectionTitleStyle}>
              <FaCalendarAlt />
              Заявка за резервация
            </h2>

            {!!blockedDates.length && (
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: "#9a3412",
                    marginBottom: "8px",
                  }}
                >
                  Блокирани дати
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {blockedDates.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        fontSize: "14px",
                        color: "#7c2d12",
                      }}
                    >
                      {formatDate(item.blocked_date)}
                      {item.reason ? ` — ${item.reason}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={submitReservation}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: "12px",
                  alignItems: "start",
                }}
              >
                <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: "18px",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>
                        Период за риболов
                      </div>
                      <DatePicker
                        range
                        startValue={arrivalDate}
                        endValue={departureDate}
                        min={new Date().toISOString().split("T")[0]}
                        disabledDates={unavailableDates}
                        placeholder="Изберете дата или период за риболов"
                        onRangeChange={({ start, end }) => {
                          setArrivalDate(start);
                          setDepartureDate(end || start);
                          setSelectedSpotIds([]);
                          setIsSpotPickerOpen(false);
                        }}
                        disabled={savingReservation || !lake.is_reservable}
                      />
                    </div>

                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "6px",
                        }}
                      >
                        <div style={{ fontSize: "12px", color: "#555" }}>
                          Риболовни места
                        </div>
                        {arrivalDate && departureDate ? (
                          <div style={{ fontSize: "13px", color: maxRequestableSpots > 0 ? "#475569" : "#b91c1c", fontWeight: 700 }}>
                            {maxRequestableSpots > 0 ? `${maxRequestableSpots} свободни` : "Няма свободни места"}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        disabled={savingReservation || !lake.is_reservable || !arrivalDate || !departureDate || maxRequestableSpots <= 0}
                        onClick={() => setIsSpotPickerOpen((value) => !value)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          border: "1px solid #d1d5db",
                          background: savingReservation || !lake.is_reservable || !arrivalDate || !departureDate || maxRequestableSpots <= 0 ? "#f8fafc" : "white",
                          color: selectedSpotCount ? "#0f172a" : "#64748b",
                          borderRadius: "10px",
                          padding: "12px 14px",
                          cursor: savingReservation || !lake.is_reservable || !arrivalDate || !departureDate || maxRequestableSpots <= 0 ? "not-allowed" : "pointer",
                          fontWeight: 800,
                          boxSizing: "border-box",
                        }}
                      >
                        <span>
                          {selectedSpotCount
                            ? `${selectedSpotCount} ${selectedSpotCount === 1 ? "място" : "места"} избрани`
                            : arrivalDate && departureDate
                              ? "Изберете места"
                              : "Първо изберете дати"}
                        </span>
                        <span style={{ color: "#2563eb" }}>{isSpotPickerOpen ? "Затвори" : "Отвори"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {isSpotPickerOpen && Array.isArray(availability?.spots) && availability.spots.length ? (
                  <div
                    style={{
                      gridColumn: isMobile ? "auto" : "1 / -1",
                      background: "#f8fbff",
                      border: "1px solid #dbeafe",
                      borderRadius: "14px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 800 }}>
                        Изберете места за риболов
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                        {selectedSpotCount} {selectedSpotCount === 1 ? "избрано" : "избрани"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {availability.spots.map((spot) => {
                        const selected = selectedSpotIds.some((item) => String(item) === String(spot.id));
                        const disabled = savingReservation || !lake.is_reservable || !spot.is_available;
                        return (
                          <button
                            key={spot.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setSelectedSpotIds((prev) => {
                                if (prev.some((item) => String(item) === String(spot.id))) {
                                  return prev.filter((item) => String(item) !== String(spot.id));
                                }
                                return [...prev, spot.id].sort();
                              });
                            }}
                            style={{
                              border: selected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                              background: selected ? "#dbeafe" : spot.is_available ? "white" : "#f1f5f9",
                              color: spot.is_available ? "#0f172a" : "#94a3b8",
                              borderRadius: "999px",
                              padding: "8px 12px",
                              fontWeight: 700,
                              cursor: disabled ? "not-allowed" : "pointer",
                            }}
                          >
                            Място {spot.spot_number}{spot.is_available ? "" : " · заето"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(availability?.blocked_dates) && availability.blocked_dates.length ? (
                  <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "12px", padding: "12px", color: "#9a3412", fontSize: "13px", fontWeight: 700 }}>
                    Блокирано в избрания период: {availability.blocked_dates.map((item) => formatDate(item.blocked_date)).join(", ")}
                  </div>
                ) : null}

                <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
                  <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                    Дневен риболов
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                    Денят на напускане е по избор. Изберете го само ако ще ловите и преди тръгване.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {allowedFishingDates.length ? allowedFishingDates.map((dateValue) => (
                      <button
                        key={dateValue}
                        type="button"
                        onClick={() => toggleDateSelection(dateValue, setFishingDates)}
                        style={{
                          border: fishingDates.includes(dateValue) ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          background: fishingDates.includes(dateValue) ? "#dbeafe" : "white",
                          color: "#0f172a",
                          borderRadius: "999px",
                          padding: "8px 12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {formatDate(dateValue)}{dateValue === departureDate && arrivalDate !== departureDate ? " · ден на напускане" : ""}
                      </button>
                    )) : <div style={{ fontSize: "13px", color: "#64748b" }}>Първо изберете дати за посещение.</div>}
                  </div>
                </div>

                {allowsNightFishing ? (
                  <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", background: "#f8fbff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "12px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: allowedNightDates.length ? "pointer" : "not-allowed" }}>
                      <input
                        type="checkbox"
                        checked={nightFishingRequested}
                        disabled={!allowedNightDates.length || savingReservation || !lake.is_reservable}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setNightFishingRequested(checked);
                          setNightFishingDates(checked ? allowedNightDates : []);
                        }}
                        style={{ marginTop: "3px" }}
                      />
                      <span>
                        <span style={{ display: "block", fontSize: "13px", color: "#0f172a", fontWeight: 800 }}>Включи нощен риболов</span>
                        <span style={{ display: "block", fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                          Добавете това, ако ще ловите през нощта
                          {nightFishingPrice ? ` (${formatCurrency(nightFishingPrice)} / нощ)` : ""}. Онлайн плащането създава незабавно платена резервация; заявките с плащане на място изчакват одобрение от собственика.
                        </span>
                      </span>
                    </label>
                    {nightFishingRequested ? (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                          Нощувки с нощен риболов
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {allowedNightDates.length ? allowedNightDates.map((dateValue) => (
                            <button
                              key={dateValue}
                              type="button"
                              onClick={() => toggleDateSelection(dateValue, setNightFishingDates)}
                              style={{
                                border: nightFishingDates.includes(dateValue) ? "1px solid #7c3aed" : "1px solid #cbd5e1",
                                background: nightFishingDates.includes(dateValue) ? "#ede9fe" : "white",
                                color: "#0f172a",
                                borderRadius: "999px",
                                padding: "8px 12px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Нощувка на {formatDate(dateValue)}
                            </button>
                          )) : <div style={{ fontSize: "13px", color: "#64748b" }}>Първо изберете период с нощувка.</div>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {lake.has_housing && Array.isArray(bookingOptions?.rooms) && bookingOptions.rooms.length ? (
                  <div className={styles.accommodationSection}>
                    <div className={styles.bookingSectionHeader}>
                      <div>
                        <h3>Настаняване</h3>
                        <p>Изберете стая или бунгало според броя хора. Цената е за стая, не за човек.</p>
                      </div>
                      <span>{selectedRoomIds.length} избрани</span>
                    </div>

                    <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#334155", marginBottom: "8px" }}>
                      Брой гости за стая
                    </label>
                    <select
                      value={roomGuestCount}
                      onChange={(event) => setRoomGuestCount(Number(event.target.value) || roomCapacityOptions[0] || 1)}
                      disabled={!roomCapacityOptions.length}
                      style={{ maxWidth: "220px", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "12px", fontWeight: 700, background: "#ffffff" }}
                    >
                      {roomCapacityOptions.map((capacity) => (
                        <option key={capacity} value={capacity}>
                          {capacity} {capacity === 1 ? "гост" : "гости"}
                        </option>
                      ))}
                    </select>

                    <div className={styles.roomList}>
                      {paginatedRooms.items.map((room) => {
                        const liveRoom = (availability?.rooms || []).find((item) => String(item.id) === String(room.id));
                        const isAvailable = liveRoom ? liveRoom.is_available : true;
                        const selected = selectedRoomIds.includes(room.id);
                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={!isAvailable || savingReservation || !lake.is_reservable}
                            className={`${styles.roomOptionCard} ${selected ? styles.roomOptionCardSelected : ""}`}
                            onClick={() => setSelectedRoomIds((prev) => prev.includes(room.id) ? prev.filter((item) => item !== room.id) : [...prev, room.id])}
                          >
                            <span className={styles.roomOptionMain}>
                              <strong>{room.name}</strong>
                              <small>Капацитет: {room.capacity || 1} гост{Number(room.capacity || 1) === 1 ? "" : "и"}</small>
                              <b>{formatCurrency(room.price_per_night)} / нощ</b>
                            </span>
                            <span className={styles.roomOptionAction}>
                              {!isAvailable ? "Заето" : selected ? "Избрано" : "Избери"}
                            </span>
                          </button>
                        );
                      })}
                      {!filteredRooms.length ? (
                        <div style={{ fontSize: "13px", color: "#64748b", padding: "12px" }}>
                          Няма свободна стая с такъв капацитет. Намалете броя гости или изберете друг период.
                        </div>
                      ) : null}
                    </div>

                    <PaginationControls
                      page={paginatedRooms.safePage}
                      totalPages={paginatedRooms.totalPages}
                      onChange={setRoomsPage}
                      itemLabel={`${filteredRooms.length} стаи`}
                    />
                  </div>
                ) : null}

                <div className={styles.paymentChoiceSection}>
                  <div className={styles.bookingSectionHeader}>
                    <div>
                      <h3>Начин на плащане</h3>
                      <p>Платете онлайн за моментална платена резервация или платете на място и изчакайте одобрение от собственика.</p>
                    </div>
                  </div>
                  <div className={styles.paymentChoiceGrid}>
                    <button
                      type="button"
                      className={`${styles.paymentChoiceCard} ${paymentPreference === "online" ? styles.paymentChoiceCardActive : ""}`}
                      onClick={() => onlinePaymentsAvailable && setPaymentPreference("online")}
                      disabled={!onlinePaymentsAvailable}
                    >
                      <strong>Плати онлайн сега</strong>
                      <span>
                        {onlinePaymentsAvailable
                          ? `Сигурно Stripe плащане. Комисионната на платформата към собственика е ${platformFeePercent}%.`
                          : "Собственикът не приема онлайн плащания за този водоем в момента."}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.paymentChoiceCard} ${paymentPreference === "on_arrival" ? styles.paymentChoiceCardActive : ""}`}
                      onClick={() => setPaymentPreference("on_arrival")}
                    >
                      <strong>Плащане на място</strong>
                      <span>Първо се изпраща заявка. Собственикът трябва да я одобри, преди да бъде потвърдена.</span>
                    </button>
                  </div>
                </div>

                <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
                  <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>
                    Бележки
                  </div>
                  <textarea
                    rows={3}
                    value={reservationNotes}
                    onChange={(event) => setReservationNotes(event.target.value.slice(0, 500))}
                    disabled={savingReservation || !lake.is_reservable}
                    placeholder="Допълнителни бележки към собственика..."
                    style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #ddd", boxSizing: "border-box", background: "white", resize: "vertical" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <div style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "10px 14px", fontWeight: 700 }}>
                  Общо: {formatCurrency(reservationQuote?.totalAmount || reservationQuote?.total_amount || 0)}
                </div>
                {reservationQuote ? (
                  <div style={{ fontSize: "13px", color: "#475569", fontWeight: 700 }}>
                    Дневен риболов: {formatCurrency(reservationQuote.baseAmount || reservationQuote.base_amount || 0)} · Нощен риболов: {formatCurrency(reservationQuote.nightFishingAmount || reservationQuote.night_fishing_amount || 0)} · Стаи: {formatCurrency(reservationQuote.roomsAmount || reservationQuote.rooms_amount || 0)}
                  </div>
                ) : null}
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                  Дневният риболов се таксува за всеки избран ден. Нощният риболов се таксува за всяка избрана нощ. Денят на напускане се таксува само ако е избран.
                </div>
              </div>

              {reservationQuoteError ? (
                <div style={{ marginTop: "10px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: "12px", padding: "10px 12px", fontSize: "13px", fontWeight: 700 }}>
                  {reservationQuoteError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={savingReservation || !lake.is_reservable || !arrivalDate || !departureDate || maxRequestableSpots <= 0 || selectedSpotCount <= 0 || selectedSpotCount > maxRequestableSpots}
                style={{ marginTop: "14px", border: "none", background: lake.is_reservable && maxRequestableSpots > 0 && selectedSpotCount > 0 && selectedSpotCount <= maxRequestableSpots ? "#16a34a" : "#94a3b8", color: "white", borderRadius: "10px", padding: "10px 14px", cursor: savingReservation || !lake.is_reservable || maxRequestableSpots <= 0 || selectedSpotCount <= 0 || selectedSpotCount > maxRequestableSpots ? "not-allowed" : "pointer", fontWeight: 700 }}
              >
                {savingReservation ? "Изпращане..." : paymentPreference === "online" ? "Продължи към плащане" : "Изпрати заявка за резервация"}
              </button>
            </form>
          </div>
        )}

        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          <h2 style={sectionTitleStyle}>
            <FaStar />
            Любими и настройки за известия
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : isPremiumRequired ? "minmax(220px, 0.8fr) minmax(0, 1.4fr)" : "repeat(4, minmax(0, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#555",
                  marginBottom: "6px",
                }}
              >
                Любим
              </div>
              <button
                type="button"
                disabled={savingAlertState}
                onClick={toggleFavoriteState}
                style={{
                  width: "100%",
                  background: alertState.favorite ? "#f59e0b" : "#e5e7eb",
                  color: alertState.favorite ? "white" : "#334155",
                  border: "none",
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: savingAlertState ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {alertState.favorite ? "Премахни от любими" : "Добави в любими"}
              </button>
            </div>

            {isPremiumRequired ? (
              <div style={{ gridColumn: isMobile ? "auto" : "span 1" }}>
                <PremiumLockedCard
                  compact
                  title="Умните известия са Премиум"
                  message="Любимите водоеми остават безплатни, но автоматичните известия за прогноза изискват Премиум достъп."
                  bullets={["Дневни или седмични имейли с прогноза", "Премиум известия за водоем"]}
                  onUpgrade={goToBilling}
                />
              </div>
            ) : (
              <>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#555",
                      marginBottom: "6px",
                    }}
                  >
                    Статус на известието
                  </div>
                  <button
                    type="button"
                    disabled={savingAlertState}
                    onClick={() =>
                      saveAlertSettings(
                        { ...alertState, enabled: !alertState.enabled },
                        alertState.enabled ? "Известието е изключено" : "Известието е включено",
                      )
                    }
                    style={{
                      width: "100%",
                      background: alertState.enabled ? "#343a40" : "#16a34a",
                      color: "white",
                      border: "none",
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: savingAlertState ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {alertState.enabled ? "Изключи известие" : "Включи известие"}
                  </button>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#555",
                      marginBottom: "6px",
                    }}
                  >
                    Честота
                  </div>
                  <select
                    value={alertState.notification_frequency || "daily"}
                    disabled={savingAlertState}
                    onChange={(event) =>
                      saveAlertSettings(
                        {
                          ...alertState,
                          notification_frequency: event.target.value,
                        },
                        "Честотата е обновена",
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      boxSizing: "border-box",
                      background: "white",
                    }}
                  >
                    <option value="daily">Дневно</option>
                    <option value="weekly">Седмично</option>
                  </select>
                </div>


              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaMapMarkerAlt />
              Карта на водоема
            </h2>

            <div className={styles.mapFrame}>
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                whenReady={(event) => {
                  lakeMapRef.current = event.target;
                }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                  maxZoom={19}
                />

                {Number.isFinite(Number(lake.latitude)) &&
                  Number.isFinite(Number(lake.longitude)) && (
                    <Marker
                      position={[Number(lake.latitude), Number(lake.longitude)]}
                      icon={selectedLakeMapIcon}
                    />
                  )}

                {lakeGeometry && (
                  <GeoJSON
                    data={lakeGeometry}
                    style={() => ({
                      color: "#2563eb",
                      fillColor: "#60a5fa",
                      fillOpacity: 0.18,
                      weight: 2,
                    })}
                  />
                )}
              </MapContainer>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
              <h2 style={{ ...sectionTitleStyle, margin: 0 }}>
                <FaCloudSun />
                Прогноза и риболовен индекс
                <span style={{ fontSize: 12, fontWeight: 900, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 999, padding: "4px 9px" }}>
                  {displayedForecastDateLabel}
                </span>
              </h2>
              <button
                type="button"
                onClick={loadWeeklyForecast}
                disabled={weeklyForecastLoading || isPremiumRequired}
                style={{
                  border: "none",
                  background: showWeeklyForecast ? "#0f172a" : "#2563eb",
                  color: "white",
                  borderRadius: "999px",
                  padding: "9px 13px",
                  fontWeight: 800,
                  cursor: weeklyForecastLoading || isPremiumRequired ? "not-allowed" : "pointer",
                  opacity: weeklyForecastLoading || isPremiumRequired ? 0.65 : 1,
                }}
              >
                {weeklyForecastLoading ? "Зареждане..." : showWeeklyForecast ? "Скрий седмичната" : "Покажи седмичната"}
              </button>
            </div>

            {forecast ? (
              <>
                {showWeeklyForecast && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "14px",
                      marginTop: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: "10px" }}>
                      Pick forecast date
                    </div>

                    {weeklyForecastError ? (
                      <div style={{ color: "#9a3412", fontWeight: 700 }}>{weeklyForecastError}</div>
                    ) : weeklyForecastLoading ? (
                      <div style={{ color: "#64748b", fontWeight: 700 }}>Зареждане на дати за прогноза...</div>
                    ) : weeklyForecast.length ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(7, minmax(0, 1fr))",
                          gap: "8px",
                        }}
                      >
                        {weeklyForecast.slice(0, 7).map((day) => {
                          const isActive = day.date === displayedForecast?.date;
                          return (
                            <button
                              type="button"
                              key={day.date}
                              onClick={() => setSelectedWeeklyForecastDate(day.date)}
                              style={{
                                border: isActive ? "1px solid #2563eb" : "1px solid #dbe3ef",
                                background: isActive ? "#2563eb" : "#fff",
                                color: isActive ? "#fff" : "#0f172a",
                                borderRadius: "12px",
                                padding: "10px 8px",
                                cursor: "pointer",
                                fontWeight: 900,
                                textAlign: "center",
                                boxShadow: isActive ? "0 10px 22px rgba(37, 99, 235, 0.22)" : "none",
                              }}
                            >
                              <span style={{ display: "block", fontSize: "12px" }}>{formatForecastDay(day.date)}</span>
                              <span style={{ display: "block", fontSize: "16px", marginTop: 3 }}>{day.total_score ?? 0}%</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b", fontWeight: 700 }}>Няма налични дати за прогноза.</div>
                    )}
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Условия
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {translateForecastText(displayedForecast?.desc || "Не е налично")}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ecfeff",
                      border: "1px solid #a5f3fc",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#0f766e",
                        marginBottom: "6px",
                      }}
                    >
                      Риболовен индекс
                    </div>
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: 900,
                        color: "#0f766e",
                      }}
                    >
                      {displayedForecast?.total_score ?? 0}%
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Температура
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <FaTemperatureHigh style={{ marginRight: "8px" }} />
                      {formatForecastNumber(displayedForecast?.temp, 1)} °C
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Вятър
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <FaWind style={{ marginRight: "8px" }} />
                      {formatForecastNumber(displayedForecast?.wind, 1)} m/s
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Налягане
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {formatForecastNumber(displayedForecast?.pressure, 0)} hPa
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Местоположение
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <FaWater style={{ marginRight: "8px" }} />
                      {displayedForecast?.location || forecast?.location || "Неизвестно"}
                    </div>
                  </div>
                </div>

                {displayedForecast?.breakdown && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        color: "#0f172a",
                        marginBottom: "10px",
                      }}
                    >
                      Разбивка на оценката
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#475569",
                        lineHeight: 1.8,
                      }}
                    >
                      Оценка за времето: {displayedForecastBreakdown.weather_score ?? "-"} / 100
                      <br />
                      Оценка за луната: {displayedForecastBreakdown.moon_score ?? "-"} / 100
                    </div>
                  </div>
                )}

                {displayedForecast?.explanation && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "12px",
                      padding: "14px",
                      marginTop: "12px",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#14532d", marginBottom: "8px" }}>
                      Защо тази оценка?
                    </div>
                    {displayedForecast.explanation.summary ? (
                      <div style={{ fontSize: "14px", color: "#166534", fontWeight: 700, marginBottom: "8px" }}>
                        {translateForecastText(displayedForecast.explanation.summary)}
                      </div>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "#166534", fontSize: "14px", lineHeight: 1.7 }}>
                      {[...(displayedForecast.explanation.reasons || []), ...(displayedForecast.explanation.warnings || [])].slice(0, 5).map((reason, reasonIndex) => (
                        <li key={`${translateForecastText(reason)}-${reasonIndex}`}>{translateForecastText(reason)}</li>
                      ))}
                    </ul>
                  </div>
                )}


              </>
            ) : isPremiumRequired ? (
              <PremiumLockedCard
                title="Оценка на прогнозата: изисква се Премиум"
                message="Отключете подробната прогноза за този водоем, включително оценка, метеорологични условия и обяснение."
                bullets={[
                  "Пълен риболовен индекс и прогнозна оценка",
                  "Подробности за дневната прогноза",
                  "Обяснение на оценката и достъп до автоматични известия",
                ]}
                onUpgrade={goToBilling}
              />
            ) : forecastError ? (
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "12px",
                  padding: "14px",
                  color: "#9a3412",
                  fontWeight: 700,
                }}
              >
                {forecastError}
              </div>
            ) : (
              <div style={{ color: "#64748b" }}>Няма налична прогноза.</div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "0.9fr 1.1fr",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaFish />
              Обобщение по видове
            </h2>

            {speciesSummary.length === 0 ? (
              <div style={{ color: "#64748b" }}>Все още няма данни за видове.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "10px" }}>
                  {paginatedSpecies.items.map((item) => (
                    <div
                      key={item.species}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        background: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
                          marginBottom: "6px",
                        }}
                      >
                        {item.species}
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#475569",
                          lineHeight: 1.7,
                        }}
                      >
                        Улови: {item.catch_count}
                        <br />
                        Средно тегло: {item.avg_weight_kg ?? "-"} kg
                        <br />
                        Максимално тегло: {item.max_weight_kg ?? "-"} kg
                      </div>
                    </div>
                  ))}
                </div>

                <PaginationControls
                  page={paginatedSpecies.safePage}
                  totalPages={paginatedSpecies.totalPages}
                  onChange={setSpeciesPage}
                  itemLabel={`${speciesSummary.length} вида`}
                />
              </>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaChartLine />
              Последни улови
            </h2>

            {catchesLoading ? (
              <CatchSkeletonList />
            ) : catches.length === 0 ? (
              <div style={{ color: "#64748b" }}>
                Все още няма записани улови за този водоем.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "12px" }}>
                  {paginatedCatches.items.map((item) => (
                    <div
                      key={item.id}
                      className={styles.catchCard}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "14px",
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {item.species || "Неизвестен вид"}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#64748b",
                              marginTop: "4px",
                            }}
                          >
                            От {item.full_name || "Неизвестен риболовец"} ·{" "}
                            {formatDateTime(item.catch_time || item.created_at)}
                          </div>
                        </div>

                        <div
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            borderRadius: "999px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            fontWeight: 800,
                          }}
                        >
                          {item.weight_kg ?? "-"} kg
                        </div>
                      </div>

                      {item.notes && (
                        <div
                          style={{
                            marginTop: "10px",
                            fontSize: "14px",
                            color: "#334155",
                            lineHeight: 1.6,
                          }}
                        >
                          {item.notes}
                        </div>
                      )}

                      {item.image_url && (
                        <ZoomableImage
                          src={`http://localhost:5000/uploads/${item.image_url}`}
                          alt={item.species || "Улов"}
                          className={styles.catchImageButton}
                          imageClassName={styles.catchImage}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <PaginationControls
                  page={paginatedCatches.safePage}
                  totalPages={paginatedCatches.totalPages}
                  onChange={setCatchesPage}
                  itemLabel={`${catches.length} улова`}
                />
              </>
            )}
          </div>
        </div>

        {photos.length > 0 && (
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaImages />
              Галерия на водоема
            </h2>

            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                {paginatedPhotos.items.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "14px",
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <ZoomableImage
                      src={`http://localhost:5000/uploads/${photo.image_url}`}
                      alt={photo.caption || "Снимка на водоема"}
                      imageClassName={styles.galleryImage}
                    />
                    <div style={{ padding: "12px" }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
                          marginBottom: "4px",
                        }}
                      >
                        {photo.caption || "Снимка на водоема"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Качена на {formatDateTime(photo.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationControls
                page={paginatedPhotos.safePage}
                totalPages={paginatedPhotos.totalPages}
                onChange={setPhotosPage}
                itemLabel={`${photos.length} снимки`}
              />
              </>
            </div>
        )}

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <h2 style={sectionTitleStyle}>
            <FaStar />
            Отзиви и оценки
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "0.9fr 1.1fr",
              gap: "20px",
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "16px",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "8px",
                }}
              >
                Средна оценка
              </div>

              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  color: "#0f172a",
                  marginBottom: "8px",
                }}
              >
                {formatAverageRating(reviewsSummary.average_rating)} / 5
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  marginBottom: "18px",
                }}
              >
                {reviewsSummary.reviews_count ?? 0} {Number(reviewsSummary.reviews_count) === 1 ? "отзив" : "отзива"}
              </div>


              <form onSubmit={submitReview}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  Вашата оценка
                </label>

                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(Number(event.target.value))}
                  disabled={savingReview}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    marginBottom: "12px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value={5}>5 - Отлично</option>
                  <option value={4}>4 - Много добро</option>
                  <option value={3}>3 - Добро</option>
                  <option value={2}>2 - Задоволително</option>
                  <option value={1}>1 - Слабо</option>
                </select>

                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  Коментар
                </label>

                <textarea
                  value={reviewComment}
                  onChange={(event) =>
                    setReviewComment(event.target.value.slice(0, 500))
                  }
                  rows={4}
                  disabled={savingReview}
                  placeholder="Споделете впечатленията си за този водоем..."
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    display: "block",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    resize: "vertical",
                    marginBottom: "8px",
                    boxSizing: "border-box",
                  }}
                />

                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    textAlign: "right",
                    marginBottom: "12px",
                  }}
                >
                  {reviewComment.length}/500
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    disabled={savingReview}
                    style={{
                      border: "none",
                      background: "#0d6efd",
                      color: "white",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      cursor: savingReview ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {savingReview ? "Запазване..." : "Запази отзива"}
                  </button>

                  <button
                    type="button"
                    onClick={deleteMyReview}
                    disabled={savingReview}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "white",
                      color: "#334155",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      cursor: savingReview ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Премахни моя отзив
                  </button>
                </div>
              </form>
            </div>

            <div style={{ minWidth: 0 }}>
              {reviews.length === 0 ? (
                <div style={{ color: "#64748b" }}>Все още няма отзиви.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {paginatedReviews.items.map((review) => (
                      <div
                        key={review.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                          padding: "14px",
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            flexWrap: "wrap",
                            marginBottom: "8px",
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
                            {review.full_name || "Анонимен потребител"}
                          </div>

                          <div
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              borderRadius: "999px",
                              padding: "5px 10px",
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            {review.rating} / 5
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            marginBottom: "8px",
                          }}
                        >
                          {formatDateTime(review.created_at)}
                        </div>

                        <div
                          style={{
                            fontSize: "14px",
                            color: "#334155",
                            lineHeight: 1.6,
                          }}
                        >
                          {review.comment || "Няма добавен коментар."}
                        </div>
                      </div>
                    ))}
                  </div>

                  <PaginationControls
                    page={paginatedReviews.safePage}
                    totalPages={paginatedReviews.totalPages}
                    onChange={setReviewsPage}
                    itemLabel={`${reviews.length} ${reviews.length === 1 ? "отзив" : "отзива"}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {lake.is_private && (
          <div
            style={{
              ...cardStyle,
              marginTop: "20px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <FaLock style={{ color: "#1d4ed8" }} />
              <div style={{ fontWeight: 800, color: "#1e3a8a" }}>
                Достъп до частен водоем
              </div>
            </div>
            <div style={{ color: "#334155", lineHeight: 1.6 }}>
              Този водоем е обозначен като частен. Резервациите се управляват от
              собственика на водоема.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LakeDetails;