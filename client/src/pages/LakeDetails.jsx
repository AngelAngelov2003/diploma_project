import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polygon } from "react-leaflet";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChartLine,
  FaCloudSun,
  FaFish,
  FaImages,
  FaLock,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaStar,
  FaTemperatureHigh,
  FaUsers,
  FaWind,
  FaWater,
} from "react-icons/fa";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

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

const formatDateTime = (value) => {
  if (!value) return "Unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleString();
};

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

function LakeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lake, setLake] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [catches, setCatches] = useState([]);
  const [speciesSummary, setSpeciesSummary] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState({ reviews_count: 0, average_rating: null });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [alertState, setAlertState] = useState({
    enabled: false,
    favorite: false,
    notification_frequency: "daily",
    min_score: 0,
  });
  const [savingAlertState, setSavingAlertState] = useState(false);
  const [reservationStatus, setReservationStatus] = useState({ is_private: false, reservation: null });
  const [blockedDates, setBlockedDates] = useState([]);
  const [reservationDate, setReservationDate] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [savingReservation, setSavingReservation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1000);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          lakeRes,
          forecastRes,
          catchesRes,
          speciesRes,
          photosRes,
          reviewsRes,
          reviewsSummaryRes,
          alertStatusRes,
          reservationStatusRes,
          blockedDatesRes,
        ] = await Promise.all([
          api.get(`/water-bodies/${id}`),
          api.get(`/water-bodies/${id}/forecast`),
          api.get(`/water-bodies/${id}/catches`),
          api.get(`/water-bodies/${id}/species-summary`),
          api.get(`/water-bodies/${id}/photos`),
          api.get(`/water-bodies/${id}/reviews`),
          api.get(`/water-bodies/${id}/reviews-summary`),
          api.get(`/alerts/status/${id}`),
          api.get(`/reservations/${id}/my-status`),
          api.get(`/water-bodies/${id}/blocked-dates`),
        ]);

        setLake(lakeRes.data || null);
        setForecast(forecastRes.data || null);
        setCatches(catchesRes.data || []);
        setSpeciesSummary(speciesRes.data || []);
        setPhotos(photosRes.data || []);
        setReviews(reviewsRes.data || []);
        setReviewsSummary(reviewsSummaryRes.data || { reviews_count: 0, average_rating: null });
        setAlertState(
          alertStatusRes.data || {
            enabled: false,
            favorite: false,
            notification_frequency: "daily",
            min_score: 0,
          }
        );
        setReservationStatus(reservationStatusRes.data || { is_private: false, reservation: null });
        setBlockedDates(blockedDatesRes.data || []);
      } catch (err) {
        notifyError(err, "Failed to load lake details");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1000);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mapCenter = useMemo(() => {
    if (lake && Number.isFinite(Number(lake.latitude)) && Number.isFinite(Number(lake.longitude))) {
      return [Number(lake.latitude), Number(lake.longitude)];
    }
    return [42.7339, 25.4858];
  }, [lake]);

  const blockedDateStrings = useMemo(
    () => new Set((blockedDates || []).map((x) => String(x.blocked_date).slice(0, 10))),
    [blockedDates]
  );

  const loadReviews = async () => {
    try {
      const [reviewsRes, reviewsSummaryRes] = await Promise.all([
        api.get(`/water-bodies/${id}/reviews`),
        api.get(`/water-bodies/${id}/reviews-summary`),
      ]);

      setReviews(reviewsRes.data || []);
      setReviewsSummary(reviewsSummaryRes.data || { reviews_count: 0, average_rating: null });
    } catch (err) {
      notifyError(err, "Failed to refresh reviews");
    }
  };

  const loadReservationStatus = async () => {
    try {
      const [statusRes, blockedDatesRes] = await Promise.all([
        api.get(`/reservations/${id}/my-status`),
        api.get(`/water-bodies/${id}/blocked-dates`),
      ]);
      setReservationStatus(statusRes.data || { is_private: false, reservation: null });
      setBlockedDates(blockedDatesRes.data || []);
    } catch (err) {
      notifyError(err, "Failed to refresh reservation status");
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (savingReview) return;

    const trimmedComment = reviewComment.trim();

    if (!Number.isInteger(Number(reviewRating)) || Number(reviewRating) < 1 || Number(reviewRating) > 5) {
      notifyError(null, "Rating must be between 1 and 5");
      return;
    }

    try {
      setSavingReview(true);
      await api.post(`/water-bodies/${id}/reviews`, {
        rating: Number(reviewRating),
        comment: trimmedComment,
      });
      notifySuccess("Review saved");
      setReviewComment("");
      setReviewRating(5);
      await loadReviews();
    } catch (err) {
      notifyError(err, "Failed to save review");
    } finally {
      setSavingReview(false);
    }
  };

  const deleteMyReview = async () => {
    if (savingReview) return;

    try {
      setSavingReview(true);
      await api.delete(`/water-bodies/${id}/reviews/me`);
      notifySuccess("Review deleted");
      await loadReviews();
    } catch (err) {
      notifyError(err, "Failed to delete review");
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
        await api.post("/alerts", {
          water_body_id: id,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
          min_score: payload.min_score,
        });
      } else {
        await api.patch(`/alerts/${id}`, {
          is_active: false,
          is_favorite: payload.is_favorite,
          notification_frequency: payload.notification_frequency,
          min_score: payload.min_score,
        });
      }

      setAlertState(nextState);
      if (successMessage) notifySuccess(successMessage);
    } catch (err) {
      notifyError(err, "Failed to update lake settings");
    } finally {
      setSavingAlertState(false);
    }
  };

  const submitReservation = async (e) => {
    e.preventDefault();
    if (savingReservation) return;

    if (!reservationDate) {
      notifyError(null, "Please choose a reservation date");
      return;
    }

    if (blockedDateStrings.has(reservationDate)) {
      notifyError(null, "This date is blocked by the lake owner");
      return;
    }

    try {
      setSavingReservation(true);
      await api.post("/reservations", {
        water_body_id: id,
        reservation_date: reservationDate,
        notes: reservationNotes.trim(),
      });
      notifySuccess("Reservation request sent");
      setReservationNotes("");
      await loadReservationStatus();
    } catch (err) {
      notifyError(err, "Failed to create reservation");
    } finally {
      setSavingReservation(false);
    }
  };

  const cancelReservation = async () => {
    if (!reservationStatus?.reservation?.id || savingReservation) return;

    try {
      setSavingReservation(true);
      await api.patch(`/reservations/${reservationStatus.reservation.id}/cancel`);
      notifySuccess("Reservation cancelled");
      await loadReservationStatus();
    } catch (err) {
      notifyError(err, "Failed to cancel reservation");
    } finally {
      setSavingReservation(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "24px", background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
        <div style={{ maxWidth: "1300px", margin: "0 auto", color: "#475569", fontWeight: 600 }}>
          Loading lake details...
        </div>
      </div>
    );
  }

  if (!lake) {
    return (
      <div style={{ padding: "24px", background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
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
    <div style={{ padding: "24px", background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
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
          <div style={{ fontSize: "13px", opacity: 0.92, marginBottom: "6px" }}>Water body details</div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "30px", fontWeight: 900 }}>{lake.name}</h1>
          <div style={{ maxWidth: "820px", lineHeight: 1.6, fontSize: "15px", opacity: 0.98 }}>
            {lake.description || "No description available."}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Type: {lake.type || "Not specified"}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {lake.is_private ? "Private lake" : "Public lake"}
            </div>

            {lake.is_private && (
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "999px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <FaMoneyBillWave style={{ marginRight: 8 }} />
                {Number(lake.price_per_day || 0).toFixed(2)} per day
              </div>
            )}

            {lake.is_private && (
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "999px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <FaUsers style={{ marginRight: 8 }} />
                Capacity {lake.capacity || 1}
              </div>
            )}

            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {catches.length} recent catches
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {speciesSummary.length} species tracked
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {photos.length} photos
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Rating: {reviewsSummary.average_rating ?? "N/A"} / 5
            </div>
          </div>
        </div>

        {lake.is_private && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h2 style={sectionTitleStyle}>
              <FaCalendarAlt />
              Private lake reservation
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
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
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>Reservations</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  {lake.is_reservable ? "Open" : "Closed"}
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
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>Availability notes</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  {lake.availability_notes || "No notes from the owner"}
                </div>
              </div>
            </div>

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
                <div style={{ fontWeight: 800, color: "#9a3412", marginBottom: "8px" }}>Blocked dates</div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {blockedDates.map((item) => (
                    <div key={item.id} style={{ fontSize: "14px", color: "#7c2d12" }}>
                      {formatDate(item.blocked_date)} {item.reason ? `— ${item.reason}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reservationStatus?.reservation ? (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                  Your latest reservation
                </div>
                <div style={{ fontSize: "14px", color: "#475569", lineHeight: 1.8 }}>
                  Date: {formatDate(reservationStatus.reservation.reservation_date)}
                  <br />
                  Status: {reservationStatus.reservation.status}
                  <br />
                  Created: {formatDateTime(reservationStatus.reservation.created_at)}
                  <br />
                  Notes: {reservationStatus.reservation.notes || "No notes"}
                </div>

                {reservationStatus.reservation.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={cancelReservation}
                    disabled={savingReservation}
                    style={{
                      marginTop: "14px",
                      border: "none",
                      background: "#dc2626",
                      color: "white",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      cursor: savingReservation ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {savingReservation ? "Cancelling..." : "Cancel reservation"}
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={submitReservation}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Reservation date</div>
                    <input
                      type="date"
                      value={reservationDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setReservationDate(e.target.value)}
                      disabled={savingReservation || !lake.is_reservable}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        boxSizing: "border-box",
                        background: "white",
                      }}
                    />
                    {reservationDate && blockedDateStrings.has(reservationDate) && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>
                        This selected date is blocked by the owner.
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Notes</div>
                    <textarea
                      rows={3}
                      value={reservationNotes}
                      onChange={(e) => setReservationNotes(e.target.value.slice(0, 500))}
                      disabled={savingReservation || !lake.is_reservable}
                      placeholder="Optional notes for the owner..."
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        boxSizing: "border-box",
                        background: "white",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingReservation || !lake.is_reservable || (reservationDate && blockedDateStrings.has(reservationDate))}
                  style={{
                    marginTop: "14px",
                    border: "none",
                    background: lake.is_reservable ? "#16a34a" : "#94a3b8",
                    color: "white",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    cursor: savingReservation || !lake.is_reservable ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {savingReservation ? "Sending..." : "Request reservation"}
                </button>
              </form>
            )}
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
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Favorite</div>
              <button
                type="button"
                disabled={savingAlertState}
                onClick={() =>
                  saveAlertSettings(
                    { ...alertState, favorite: !alertState.favorite },
                    alertState.favorite ? "Removed from favorites" : "Added to favorites"
                  )
                }
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

            <div>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Alert Status</div>
              <button
                type="button"
                disabled={savingAlertState}
                onClick={() =>
                  saveAlertSettings(
                    { ...alertState, enabled: !alertState.enabled },
                    alertState.enabled ? "Alert disabled" : "Alert enabled"
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
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Frequency</div>
              <select
                value={alertState.notification_frequency || "daily"}
                disabled={savingAlertState}
                onChange={(e) =>
                  saveAlertSettings({ ...alertState, notification_frequency: e.target.value }, "Frequency updated")
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
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Minimum Score</div>
              <input
                type="number"
                min="0"
                max="100"
                value={Number(alertState.min_score || 0)}
                disabled={savingAlertState}
                onChange={(e) =>
                  setAlertState((prev) => ({
                    ...prev,
                    min_score: Math.max(0, Math.min(100, Number(e.target.value || 0))),
                  }))
                }
                onBlur={() =>
                  saveAlertSettings(
                    { ...alertState, min_score: Number(alertState.min_score || 0) },
                    "Minimum score updated"
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

            <div style={{ height: "420px", borderRadius: "14px", overflow: "hidden" }}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                  maxZoom={19}
                />

                {Number.isFinite(Number(lake.latitude)) && Number.isFinite(Number(lake.longitude)) && (
                  <Marker position={[Number(lake.latitude), Number(lake.longitude)]} />
                )}

                {lake.boundary?.coordinates?.[0] && (
                  <Polygon
                    positions={lake.boundary.coordinates[0].map((coord) => [coord[1], coord[0]])}
                    pathOptions={{
                      color: "#0d6efd",
                      fillColor: "#38bdf8",
                      fillOpacity: 0.35,
                      weight: 3,
                    }}
                  />
                )}
              </MapContainer>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaCloudSun />
              Forecast and fishing index
            </h2>

            {forecast ? (
              <>
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
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      Conditions
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      {forecast.desc || "N/A"}
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
                    <div style={{ fontSize: "12px", color: "#0f766e", marginBottom: "6px" }}>
                      Fishing index
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f766e" }}>
                      {forecast.total_score ?? 0}%
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
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      Temperature
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      <FaTemperatureHigh style={{ marginRight: "8px" }} />
                      {forecast.temp ?? "-"} °C
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
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      Wind
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      <FaWind style={{ marginRight: "8px" }} />
                      {forecast.wind ?? "-"} m/s
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
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      Pressure
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      {forecast.pressure ?? "-"} hPa
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
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                      Location
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      <FaWater style={{ marginRight: "8px" }} />
                      {forecast.location || "Unknown"}
                    </div>
                  </div>
                </div>

                {forecast.breakdown && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
                      AI score breakdown
                    </div>
                    <div style={{ fontSize: "14px", color: "#475569", lineHeight: 1.8 }}>
                      Weather score: {forecast.breakdown.weather_score ?? "-"} / 100
                      <br />
                      Moon score: {forecast.breakdown.moon_score ?? "-"} / 100
                    </div>
                  </div>
                )}
              </>
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
              <div style={{ display: "grid", gap: "10px" }}>
                {speciesSummary.map((item) => (
                  <div
                    key={item.species}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                      {item.species}
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.7 }}>
                      Catches: {item.catches_count}
                      <br />
                      Average weight: {item.avg_weight_kg ?? "-"} kg
                      <br />
                      Max weight: {item.max_weight_kg ?? "-"} kg
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              <FaChartLine />
              Recent catches
            </h2>

            {catches.length === 0 ? (
              <div style={{ color: "#64748b" }}>No catches logged for this lake yet.</div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {catches.map((item) => (
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
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                          {item.species || "Unknown species"}
                        </div>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                          By {item.full_name || "Unknown angler"} · {formatDateTime(item.catch_time || item.created_at)}
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
                      <div style={{ marginTop: "10px", fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
                        {item.notes}
                      </div>
                    )}

                    {item.image_url && (
                      <img
                        src={`http://localhost:5000/uploads/${item.image_url}`}
                        alt={item.species || "Catch"}
                        style={{
                          width: "100%",
                          maxHeight: "280px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          marginTop: "12px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <FaImages />
            Photo gallery
          </h2>

          {photos.length === 0 ? (
            <div style={{ color: "#64748b" }}>No photos uploaded for this lake yet.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <img
                    src={`http://localhost:5000/uploads/${photo.image_url}`}
                    alt={photo.species || "Lake photo"}
                    style={{
                      width: "100%",
                      height: "180px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
                      {photo.species || "Catch photo"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {photo.weight_kg ?? "-"} kg · {formatDateTime(photo.catch_time || photo.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Average rating</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a", marginBottom: "8px" }}>
                {reviewsSummary.average_rating ?? "N/A"} / 5
              </div>
              <div style={{ fontSize: "13px", color: "#475569", marginBottom: "18px" }}>
                {reviewsSummary.reviews_count ?? 0} review{Number(reviewsSummary.reviews_count) === 1 ? "" : "s"}
              </div>

              <form onSubmit={submitReview}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  Your rating
                </label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  disabled={savingReview}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    marginBottom: "12px",
                  }}
                >
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Very good</option>
                  <option value={3}>3 - Good</option>
                  <option value={2}>2 - Fair</option>
                  <option value={1}>1 - Poor</option>
                </select>

                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  Comment
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                  rows={4}
                  disabled={savingReview}
                  placeholder="Share your experience with this lake..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    resize: "vertical",
                    marginBottom: "8px",
                  }}
                />

                <div style={{ fontSize: "12px", color: "#64748b", textAlign: "right", marginBottom: "12px" }}>
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
                    Delete my review
                  </button>
                </div>
              </form>
            </div>

            <div>
              {reviews.length === 0 ? (
                <div style={{ color: "#64748b" }}>No reviews yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {reviews.map((review) => (
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

                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                        {formatDateTime(review.created_at)}
                      </div>

                      <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
                        {review.comment || "No comment provided."}
                      </div>
                    </div>
                  ))}
                </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <FaLock style={{ color: "#1d4ed8" }} />
              <div style={{ fontWeight: 800, color: "#1e3a8a" }}>Private lake access</div>
            </div>
            <div style={{ color: "#334155", lineHeight: 1.6 }}>
              This lake is marked as private. Reservations are managed by the lake owner.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LakeDetails;