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
  min_score: 0,
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
    return "No rating yet";
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
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const getForecastScoreTone = (score) => {
  const numeric = Number(score);
  if (numeric >= 80) return { background: "#dcfce7", border: "#86efac", color: "#166534" };
  if (numeric >= 60) return { background: "#ecfeff", border: "#67e8f9", color: "#0f766e" };
  if (numeric >= 40) return { background: "#fff7ed", border: "#fed7aa", color: "#9a3412" };
  return { background: "#fef2f2", border: "#fecaca", color: "#991b1b" };
};

const formatDateTime = (value) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
};

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const DEFAULT_PAGE_SIZES = {
  species: 3,
  catches: 3,
  photos: 10,
  reviews: 4,
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
        Page {page} of {totalPages}
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
          Previous
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
          Next
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
      notifyError(error, "Failed to refresh reviews");
    }
  };


  useEffect(() => {
    let cancelled = false;

    const resetSecondaryLakeData = () => {
      setForecast(null);
      setForecastError("");
      setCatches([]);
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
          notifyError(error, "Failed to load lake details");
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
            ? "Premium subscription required to unlock the full AI fishing forecast."
            : forecastData?.error?.response?.data?.error ||
              "Forecast temporarily unavailable. Please try again later."
        );
      }
      setCatches(catchesData || []);
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
          ? "Premium subscription required to unlock the weekly forecast."
          : error?.response?.data?.error ||
              "Weekly forecast temporarily unavailable. Please try again later."
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
    setSpeciesPage(1);
    setCatchesPage(1);
    setPhotosPage(1);
    setReviewsPage(1);
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
      notifyError(null, "Rating must be between 1 and 5");
      return;
    }

    try {
      setSavingReview(true);

      await createWaterBodyReview(id, {
        rating: normalizedRating,
        comment: trimmedComment,
      });

      notifySuccess("Review saved");
      setReviewComment("");
      setReviewRating(5);
      await loadReviews();
    } catch (error) {
      notifyError(error, "Failed to save review");
    } finally {
      setSavingReview(false);
    }
  };

  const deleteMyReview = async () => {
    if (savingReview) {
      return;
    }

    try {
      setSavingReview(true);
      await deleteMyWaterBodyReview(id);
      notifySuccess("Review deleted");
      await loadReviews();
    } catch (error) {
      notifyError(error, "Failed to delete review");
    } finally {
      setSavingReview(false);
    }
  };

  const saveAlertSettings = async (nextState, successMessage) => {
    try {
      setSavingAlertState(true);

      const payload = {
        is_active: Boolean(nextState.enabled),
        is_favorite: Boolean(nextState.favorite),
        notification_frequency: nextState.notification_frequency || "daily",
        min_score: Number(nextState.min_score || 0),
      };

      if (payload.is_active) {
        await createAlert({
          water_body_id: id,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
          min_score: payload.min_score,
        });
      } else if (alertState.enabled || alertState.favorite) {
        await updateAlert(id, {
          is_active: false,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
          min_score: payload.min_score,
        });
      } else if (payload.is_favorite) {
        await createFavorite(id);
      }

      setAlertState(nextState);

      if (successMessage) {
        notifySuccess(successMessage);
      }
    } catch (error) {
      notifyError(error, "Failed to update lake settings");
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
        if (alertState.enabled) {
          await updateAlert(id, { is_favorite: false });
        } else {
          await deleteFavorite(id);
        }

        setAlertState((prev) => ({ ...prev, favorite: false }));
        notifySuccess("Removed from favorites");
        return;
      }

      if (alertState.enabled) {
        await updateAlert(id, { is_favorite: true });
      } else {
        await createFavorite(id);
      }

      setAlertState((prev) => ({ ...prev, favorite: true }));
      notifySuccess("Added to favorites");
    } catch (error) {
      notifyError(error, "Failed to update favorite state");
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
          setReservationQuoteError(error?.response?.data?.error || "Could not calculate the reservation price for the selected range.");
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
      notifyError(null, "Please choose arrival and departure dates");
      return;
    }
    if (!fishingDates.length && !nightFishingDates.length && !selectedRoomIds.length) {
      notifyError(null, "Select at least one fishing day, night fishing night, or room");
      return;
    }
    if (maxRequestableSpots <= 0) {
      notifyError(null, "No fishing spots are available for the selected date range");
      return;
    }
    if (selectedSpotCount <= 0) {
      notifyError(null, "Please choose at least one fishing spot");
      return;
    }
    if (selectedSpotCount > maxRequestableSpots) {
      notifyError(null, `Only ${maxRequestableSpots} fishing spot${maxRequestableSpots === 1 ? "" : "s"} are available for the selected range`);
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
        notifySuccess("Reservation created. Redirecting to secure payment...");
        const payment = await startReservationPayment(reservation.id);
        if (payment?.url) {
          window.location.href = payment.url;
          return;
        }
      }

      notifySuccess("Reservation request sent successfully");
      navigate("/reservations", { state: { reservationSubmitted: true } });
    } catch (error) {
      notifyError(error, "Failed to create reservation");
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
          Loading lake details...
        </div>
      </div>
    );
  }

  const selectedWeeklyForecast = weeklyForecast.find((day) => day.date === selectedWeeklyForecastDate) || weeklyForecast[0] || null;
  const displayedForecast = showWeeklyForecast && selectedWeeklyForecast ? selectedWeeklyForecast : forecast;
  const displayedForecastBreakdown = displayedForecast?.breakdown || {};
  const displayedForecastDateLabel = showWeeklyForecast && selectedWeeklyForecast?.date
    ? formatForecastDay(selectedWeeklyForecast.date)
    : "Today";

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
            Back to map
          </button>
          <div style={cardStyle}>Lake not found.</div>
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
          Back to map
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
            Water body details
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
              {descriptionExpanded ? "Show less" : "Show more"}
            </button>
          ) : null}

        </div>

        {lake.is_private && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h2 style={sectionTitleStyle}>
              <FaCalendarAlt />
              Reservation request
            </h2>

            {lake.availability_notes ? (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                  Notes from owner
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  {lake.availability_notes}
                </div>
              </div>
            ) : null}

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
                  Blocked dates
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
                        Fishing date range
                      </div>
                      <DatePicker
                        range
                        startValue={arrivalDate}
                        endValue={departureDate}
                        min={new Date().toISOString().split("T")[0]}
                        disabledDates={unavailableDates}
                        placeholder="Choose fishing date or range"
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
                          Fishing spots
                        </div>
                        {arrivalDate && departureDate ? (
                          <div style={{ fontSize: "13px", color: maxRequestableSpots > 0 ? "#475569" : "#b91c1c", fontWeight: 700 }}>
                            {maxRequestableSpots > 0 ? `${maxRequestableSpots} available` : "No spots available"}
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
                            ? `${selectedSpotCount} spot${selectedSpotCount === 1 ? "" : "s"} selected`
                            : arrivalDate && departureDate
                              ? "Choose spots"
                              : "Choose dates first"}
                        </span>
                        <span style={{ color: "#2563eb" }}>{isSpotPickerOpen ? "Close" : "Open"}</span>
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
                        Choose fishing spots
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                        {selectedSpotCount} selected
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
                            Spot {spot.spot_number}{spot.is_available ? "" : " · booked"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(availability?.blocked_dates) && availability.blocked_dates.length ? (
                  <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "12px", padding: "12px", color: "#9a3412", fontSize: "13px", fontWeight: 700 }}>
                    Blocked in selected range: {availability.blocked_dates.map((item) => formatDate(item.blocked_date)).join(", ")}
                  </div>
                ) : null}

                <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
                  <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                    Day fishing
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                    The departure day is optional. Select it only if you will also fish before leaving.
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
                        {formatDate(dateValue)}{dateValue === departureDate && arrivalDate !== departureDate ? " · departure day" : ""}
                      </button>
                    )) : <div style={{ fontSize: "13px", color: "#64748b" }}>Choose trip dates first.</div>}
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
                        <span style={{ display: "block", fontSize: "13px", color: "#0f172a", fontWeight: 800 }}>Include night fishing</span>
                        <span style={{ display: "block", fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                          Add this if you will fish during the night
                          {nightFishingPrice ? ` (${formatCurrency(nightFishingPrice)} / night)` : ""}. Online payment creates an instant paid booking; pay-on-arrival requests wait for owner approval.
                        </span>
                      </span>
                    </label>
                    {nightFishingRequested ? (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                          Night fishing nights
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
                              Night of {formatDate(dateValue)}
                            </button>
                          )) : <div style={{ fontSize: "13px", color: "#64748b" }}>Choose an overnight trip range first.</div>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {lake.has_housing && Array.isArray(bookingOptions?.rooms) && bookingOptions.rooms.length ? (
                  <div className={styles.accommodationSection}>
                    <div className={styles.bookingSectionHeader}>
                      <div>
                        <h3>Accommodation</h3>
                        <p>Choose optional rooms or cabins for your selected stay.</p>
                      </div>
                      <span>{selectedRoomIds.length} selected</span>
                    </div>

                    <div className={styles.roomList}>
                      {bookingOptions.rooms.map((room) => {
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
                              <small>Capacity: {room.capacity || 1} guest{Number(room.capacity || 1) === 1 ? "" : "s"}</small>
                              <b>{formatCurrency(room.price_per_night)} / night</b>
                            </span>
                            <span className={styles.roomOptionAction}>
                              {!isAvailable ? "Booked" : selected ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className={styles.paymentChoiceSection}>
                  <div className={styles.bookingSectionHeader}>
                    <div>
                      <h3>Payment option</h3>
                      <p>Pay online for an instant paid booking, or pay at the lake and wait for owner approval.</p>
                    </div>
                  </div>
                  <div className={styles.paymentChoiceGrid}>
                    <button
                      type="button"
                      className={`${styles.paymentChoiceCard} ${paymentPreference === "online" ? styles.paymentChoiceCardActive : ""}`}
                      onClick={() => setPaymentPreference("online")}
                    >
                      <strong>Pay online now</strong>
                      <span>Secure Stripe checkout. No owner approval step if payment is available.</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.paymentChoiceCard} ${paymentPreference === "on_arrival" ? styles.paymentChoiceCardActive : ""}`}
                      onClick={() => setPaymentPreference("on_arrival")}
                    >
                      <strong>Pay at the lake</strong>
                      <span>Sends a request first. The owner must approve it before it is confirmed.</span>
                    </button>
                  </div>
                </div>

                <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
                  <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>
                    Notes
                  </div>
                  <textarea
                    rows={3}
                    value={reservationNotes}
                    onChange={(event) => setReservationNotes(event.target.value.slice(0, 500))}
                    disabled={savingReservation || !lake.is_reservable}
                    placeholder="Optional notes for the owner..."
                    style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #ddd", boxSizing: "border-box", background: "white", resize: "vertical" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <div style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "10px 14px", fontWeight: 700 }}>
                  Total: {formatCurrency(reservationQuote?.totalAmount || reservationQuote?.total_amount || 0)}
                </div>
                {reservationQuote ? (
                  <div style={{ fontSize: "13px", color: "#475569", fontWeight: 700 }}>
                    Day fishing: {formatCurrency(reservationQuote.baseAmount || reservationQuote.base_amount || 0)} · Night fishing: {formatCurrency(reservationQuote.nightFishingAmount || reservationQuote.night_fishing_amount || 0)} · Rooms: {formatCurrency(reservationQuote.roomsAmount || reservationQuote.rooms_amount || 0)}
                  </div>
                ) : null}
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                  Day fishing is charged per selected day. Night fishing is charged per selected night. The departure day is charged only when selected.
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
                {savingReservation ? "Sending..." : paymentPreference === "online" ? "Continue to payment" : "Send reservation request"}
              </button>
            </form>
          </div>
        )}

        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          <h2 style={sectionTitleStyle}>
            <FaStar />
            Favorite and notification settings
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
                Favorite
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
                {alertState.favorite ? "Unfavorite" : "Mark Favorite"}
              </button>
            </div>

            {isPremiumRequired ? (
              <div style={{ gridColumn: isMobile ? "auto" : "span 1" }}>
                <PremiumLockedCard
                  compact
                  title="Smart alerts are Premium"
                  message="Favorites stay free, but automatic forecast alerts require Premium access."
                  bullets={["Daily or weekly forecast emails", "Minimum score alert threshold", "Premium lake notifications"]}
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
                    Alert Status
                  </div>
                  <button
                    type="button"
                    disabled={savingAlertState}
                    onClick={() =>
                      saveAlertSettings(
                        { ...alertState, enabled: !alertState.enabled },
                        alertState.enabled ? "Alert disabled" : "Alert enabled",
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
                    {alertState.enabled ? "Disable Alert" : "Enable Alert"}
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
                    Frequency
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
                        "Frequency updated",
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
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#555",
                      marginBottom: "6px",
                    }}
                  >
                    Minimum Score
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number(alertState.min_score || 0)}
                    disabled={savingAlertState}
                    onChange={(event) =>
                      setAlertState((prev) => ({
                        ...prev,
                        min_score: Math.max(
                          0,
                          Math.min(100, Number(event.target.value || 0)),
                        ),
                      }))
                    }
                    onBlur={() =>
                      saveAlertSettings(
                        {
                          ...alertState,
                          min_score: Number(alertState.min_score || 0),
                        },
                        "Minimum score updated",
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
                  />
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
              Lake map
            </h2>

            <div
              style={{
                height: "420px",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
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
                Forecast and fishing index
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
                {weeklyForecastLoading ? "Loading week..." : showWeeklyForecast ? "Hide weekly" : "Show weekly"}
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
                      <div style={{ color: "#64748b", fontWeight: 700 }}>Loading forecast dates...</div>
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
                      <div style={{ color: "#64748b", fontWeight: 700 }}>No forecast dates available.</div>
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
                      Conditions
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {displayedForecast?.desc || "Not available"}
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
                      Fishing index
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
                      Temperature
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
                      Wind
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
                      Pressure
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
                      Location
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <FaWater style={{ marginRight: "8px" }} />
                      {displayedForecast?.location || forecast?.location || "Unknown"}
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
                      AI score breakdown
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#475569",
                        lineHeight: 1.8,
                      }}
                    >
                      Weather score: {displayedForecastBreakdown.weather_score ?? "-"} / 100
                      <br />
                      Moon score: {displayedForecastBreakdown.moon_score ?? "-"} / 100
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
                      Why this score?
                    </div>
                    {displayedForecast.explanation.summary ? (
                      <div style={{ fontSize: "14px", color: "#166534", fontWeight: 700, marginBottom: "8px" }}>
                        {displayedForecast.explanation.summary}
                      </div>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "#166534", fontSize: "14px", lineHeight: 1.7 }}>
                      {[...(displayedForecast.explanation.reasons || []), ...(displayedForecast.explanation.warnings || [])].slice(0, 5).map((reason, reasonIndex) => (
                        <li key={`${reason}-${reasonIndex}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}


              </>
            ) : isPremiumRequired ? (
              <PremiumLockedCard
                title="Forecast Score: Premium Required"
                message="Unlock the full AI fishing forecast for this lake, including the score, weather conditions, and explanation."
                bullets={[
                  "Full fishing index and forecast score",
                  "Daily prediction details",
                  "AI explanation and smart alert access",
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
              <div style={{ color: "#64748b" }}>No forecast available.</div>
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
              Species summary
            </h2>

            {speciesSummary.length === 0 ? (
              <div style={{ color: "#64748b" }}>No species data yet.</div>
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
                        Catches: {item.catches_count}
                        <br />
                        Average weight: {item.avg_weight_kg ?? "-"} kg
                        <br />
                        Max weight: {item.max_weight_kg ?? "-"} kg
                      </div>
                    </div>
                  ))}
                </div>

                <PaginationControls
                  page={paginatedSpecies.safePage}
                  totalPages={paginatedSpecies.totalPages}
                  onChange={setSpeciesPage}
                  itemLabel={`${speciesSummary.length} species`}
                />
              </>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaChartLine />
              Recent catches
            </h2>

            {catches.length === 0 ? (
              <div style={{ color: "#64748b" }}>
                No catches logged for this lake yet.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "12px" }}>
                  {paginatedCatches.items.map((item) => (
                    <div
                      key={item.id}
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
                            {item.species || "Unknown species"}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#64748b",
                              marginTop: "4px",
                            }}
                          >
                            By {item.full_name || "Unknown angler"} ·{" "}
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
                          alt={item.species || "Catch"}
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
                  itemLabel={`${catches.length} catches`}
                />
              </>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <FaImages />
            Lake gallery
          </h2>

          {photos.length === 0 ? (
            <div style={{ color: "#64748b" }}>
              No owner gallery photos uploaded for this lake yet.
            </div>
          ) : (
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
                      alt={photo.caption || "Lake photo"}
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
                        {photo.caption || "Lake photo"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Uploaded {formatDateTime(photo.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationControls
                page={paginatedPhotos.safePage}
                totalPages={paginatedPhotos.totalPages}
                onChange={setPhotosPage}
                itemLabel={`${photos.length} photos`}
              />
            </>
          )}
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <h2 style={sectionTitleStyle}>
            <FaStar />
            Reviews and ratings
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
                Average rating
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
                {reviewsSummary.reviews_count ?? 0} review
                {Number(reviewsSummary.reviews_count) === 1 ? "" : "s"}
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
                  Your rating
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
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Very good</option>
                  <option value={3}>3 - Good</option>
                  <option value={2}>2 - Fair</option>
                  <option value={1}>1 - Poor</option>
                </select>

                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  Comment
                </label>

                <textarea
                  value={reviewComment}
                  onChange={(event) =>
                    setReviewComment(event.target.value.slice(0, 500))
                  }
                  rows={4}
                  disabled={savingReview}
                  placeholder="Share your experience with this lake..."
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
                    {savingReview ? "Saving..." : "Save review"}
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
                    Remove my review
                  </button>
                </div>
              </form>
            </div>

            <div style={{ minWidth: 0 }}>
              {reviews.length === 0 ? (
                <div style={{ color: "#64748b" }}>No reviews yet.</div>
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
                            {review.full_name || "Anonymous"}
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
                          {review.comment || "No comment provided."}
                        </div>
                      </div>
                    ))}
                  </div>

                  <PaginationControls
                    page={paginatedReviews.safePage}
                    totalPages={paginatedReviews.totalPages}
                    onChange={setReviewsPage}
                    itemLabel={`${reviews.length} reviews`}
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
                Private lake access
              </div>
            </div>
            <div style={{ color: "#334155", lineHeight: 1.6 }}>
              This lake is marked as private. Reservations are managed by the
              lake owner.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LakeDetails;