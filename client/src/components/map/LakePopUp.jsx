import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaTimes,
  FaChartBar,
  FaThermometerHalf,
  FaMoon,
  FaCamera,
  FaStar,
  FaBell,
  FaMapMarkedAlt,
  FaCalendarAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import PremiumLockedCard from "../common/PremiumLockedCard";
import ZoomableImage from "../ui/ZoomableImage";
import api from "../../api/client";
import { getWaterBodyById } from "../../api/waterBodiesApi";
import { notifyError, notifySuccess } from "../../ui/toast";
import {
  getDisplayDescription,
  truncate,
} from "../../features/fishing-map/fishingMap.utils";

const MAX_NOTES_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const toLocalDateTimeValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatForecastDay = (value) => {
  if (!value) return "Неизвестно";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bg-BG", { weekday: "short", month: "short", day: "numeric" });
};


const formatForecastNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
};

const LakePopup = ({ lake, map }) => {
  const navigate = useNavigate();

  const [forecast, setForecast] = useState(null);
  const [weeklyForecast, setWeeklyForecast] = useState([]);
  const [showWeeklyForecast, setShowWeeklyForecast] = useState(false);
  const [selectedWeeklyForecastDate, setSelectedWeeklyForecastDate] = useState("");
  const [forecastLocked, setForecastLocked] = useState(false);
  const [alertLocked, setAlertLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [species, setSpecies] = useState("");
  const [weight, setWeight] = useState("");
  const [image, setImage] = useState(null);
  const [catchTime, setCatchTime] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  const [alertEnabled, setAlertEnabled] = useState(false);
  const [favoriteEnabled, setFavoriteEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [resolvedDescription, setResolvedDescription] = useState(
    typeof lake?.description === "string" ? lake.description : "",
  );

  const statusLoadedLakeRef = useRef(null);
  const descriptionLoadedLakeRef = useRef(null);
  const activePanelRef = useRef(null);

  const lakeLat = Number(lake?.latitude);
  const lakeLng = Number(lake?.longitude);
  const hasValidCoords = Number.isFinite(lakeLat) && Number.isFinite(lakeLng);

  const popupDescription = getDisplayDescription(resolvedDescription || lake?.description);
  const popupDescriptionPreview = truncate(popupDescription, 140);
  const popupDescriptionCanExpand =
    popupDescriptionPreview !== popupDescription;

  useEffect(() => {
    if (!catchTime) setCatchTime(toLocalDateTimeValue(new Date()));
  }, [catchTime]);

  useEffect(() => {
    statusLoadedLakeRef.current = null;
    descriptionLoadedLakeRef.current = null;
    setResolvedDescription(typeof lake?.description === "string" ? lake.description : "");
    setForecast(null);
    setWeeklyForecast([]);
    setShowWeeklyForecast(false);
    setForecastLocked(false);
    setActivePanel(null);
    setDescriptionExpanded(false);
    setMsg("");
    setSpecies("");
    setWeight("");
    setImage(null);
    setCatchTime(toLocalDateTimeValue(new Date()));
    setNotes("");
  }, [lake?.id, lake?.description]);

  useEffect(() => {
    let cancelled = false;

    const shouldFetchDescription = !String(lake?.description || "").trim();

    if (!lake?.id || !shouldFetchDescription) {
      return () => {
        cancelled = true;
      };
    }

    if (descriptionLoadedLakeRef.current === String(lake.id)) {
      return () => {
        cancelled = true;
      };
    }

    descriptionLoadedLakeRef.current = String(lake.id);

    const run = async () => {
      try {
        const details = await getWaterBodyById(lake.id);

        if (cancelled) {
          return;
        }

        const nextDescription =
          typeof details?.description === "string" ? details.description : "";

        if (nextDescription.trim()) {
          setResolvedDescription(nextDescription);
        }
      } catch {
        if (!cancelled) {
          setResolvedDescription("");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [lake?.id, lake?.description]);

  useEffect(() => {
    let cancelled = false;

    if (!lake?.id) return;

    if (statusLoadedLakeRef.current === String(lake.id)) {
      return;
    }

    statusLoadedLakeRef.current = String(lake.id);

    const run = async () => {
      try {
        setAlertLoading(true);

        const res = await api.get(`/alerts/status/${lake.id}`, {
          skipErrorToast: true,
        });

        if (cancelled) return;

        setAlertEnabled(Boolean(res.data?.enabled));
        setFavoriteEnabled(Boolean(res.data?.favorite));
      } catch {
        if (cancelled) return;
        setAlertEnabled(false);
        setFavoriteEnabled(false);
      } finally {
        if (!cancelled) {
          setAlertLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [lake?.id]);

  useEffect(() => {
    if (!activePanel || !activePanelRef.current) return;

    const timer = window.setTimeout(() => {
      activePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activePanel, forecast]);

  const imagePreviewUrl = useMemo(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
  }, [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const resetForm = () => {
    setSpecies("");
    setWeight("");
    setImage(null);
    setCatchTime(toLocalDateTimeValue(new Date()));
    setNotes("");
    setMsg("");
  };

  const toggleAlert = async (e) => {
    e.stopPropagation();
    if (!lake?.id || alertLoading) return;

    try {
      setAlertLoading(true);

      if (alertEnabled) {
        if (!window.confirm("Сигурни ли сте, че искате да изключите известията за този водоем?")) return;
        await api.delete(`/alerts/${lake.id}`);
        setAlertEnabled(false);
        notifySuccess("Известието е изключено");
      } else {
        await api.post("/alerts", {
          water_body_id: lake.id,
          is_favorite: favoriteEnabled,
          notification_frequency: "daily",
        });
        setAlertEnabled(true);
        notifySuccess("Известието е включено");
      }
    } catch (err) {
      if (err?.response?.data?.code === "PREMIUM_REQUIRED") {
        setAlertLocked(true);
        setActivePanel("premium-alert");
        notifyError(null, "За автоматични известия е нужен Premium абонамент. Отворете Плащания / Premium от менюто.");
      } else {
        notifyError(
          err,
          alertEnabled ? "Неуспешно изключване на известието" : "Неуспешно включване на известието",
        );
      }
    } finally {
      setAlertLoading(false);
    }
  };

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (!lake?.id || alertLoading) return;

    try {
      setAlertLoading(true);

      if (favoriteEnabled) {
        if (!window.confirm("Сигурни ли сте, че искате да премахнете този водоем от любими?")) return;
        await api.delete(`/favorites/${lake.id}`);
        setFavoriteEnabled(false);
        notifySuccess("Премахнато от любими");
      } else {
        await api.post("/favorites", { water_body_id: lake.id });
        setFavoriteEnabled(true);
        notifySuccess("Добавено в любими");
      }
    } catch (err) {
      notifyError(
        err,
        favoriteEnabled
          ? "Неуспешно премахване от любими"
          : "Неуспешно добавяне в любими",
      );
    } finally {
      setAlertLoading(false);
    }
  };

  const getForecast = async () => {
    setMsg("");

    if (!lake?.id || !hasValidCoords) {
      notifyError(null, "Координатите на водоема не са налични");
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/forecast/${lakeLat}/${lakeLng}`);
      setForecastLocked(false);
      setForecast(res.data || null);
      setActivePanel("forecast");

      if (map) {
        map.setView([lakeLat, lakeLng], map.getZoom(), { animate: true });
      }
    } catch (err) {
      if (err?.response?.data?.code === "PREMIUM_REQUIRED") {
        setForecast(null);
        setForecastLocked(true);
        setActivePanel("forecast");
        notifyError(null, "За отключване на прогнозата е нужен Premium абонамент. Отворете Плащания / Premium от менюто.");
      } else {
        notifyError(err, "Грешка при зареждане на прогнозата");
      }
    } finally {
      setLoading(false);
    }
  };


  const toggleWeeklyForecast = async (e) => {
    e.stopPropagation();

    if (!lake?.id || !hasValidCoords || loading) {
      return;
    }

    if (showWeeklyForecast) {
      setShowWeeklyForecast(false);
      return;
    }

    setShowWeeklyForecast(true);

    if (weeklyForecast.length) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/forecast/${lakeLat}/${lakeLng}/weekly`);
      setForecastLocked(false);
      const safeData = Array.isArray(res.data) ? res.data.slice(0, 7) : [];
      setWeeklyForecast(safeData);
      setSelectedWeeklyForecastDate((current) => current || safeData[0]?.date || "");
      setActivePanel("forecast");
    } catch (err) {
      if (err?.response?.data?.code === "PREMIUM_REQUIRED") {
        setForecast(null);
        setWeeklyForecast([]);
        setForecastLocked(true);
        setActivePanel("forecast");
        notifyError(null, "За седмичната прогноза е нужен Premium абонамент. Отворете Плащания / Premium от менюто.");
      } else {
        notifyError(err, "Грешка при зареждане на седмичната прогноза");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setImage(null);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setMsg("Снимката трябва да е 5 MB или по-малка");
      notifyError(null, "Снимката трябва да е 5 MB или по-малка");
      e.target.value = "";
      return;
    }

    setMsg("");
    setImage(file);
  };

  const handleLogCatch = async (e) => {
    e.preventDefault();
    if (saving) return;

    const trimmedSpecies = species.trim();
    const parsedWeight = Number.parseFloat(weight);

    if (!trimmedSpecies) {
      setMsg("Видът риба е задължителен");
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setMsg("Теглото трябва да е по-голямо от 0");
      return;
    }

    if (notes.length > MAX_NOTES_LENGTH) {
      setMsg(`Бележките трябва да са до ${MAX_NOTES_LENGTH} символа`);
      return;
    }

    if (image && image.size > MAX_IMAGE_SIZE_BYTES) {
      setMsg("Снимката трябва да е 5 MB или по-малка");
      return;
    }

    setMsg("");
    setSaving(true);

    const formData = new FormData();
    formData.append("water_body_id", lake.id);
    formData.append("species", trimmedSpecies);
    formData.append("weight_kg", String(parsedWeight));
    formData.append("catch_time", catchTime || "");
    formData.append("notes", notes.trim());

    if (forecast) {
      formData.append("temperature", forecast.temp ?? "");
      formData.append("pressure", forecast.pressure ?? "");
      formData.append("wind_speed", forecast.wind ?? "");
      formData.append("humidity", forecast.humidity ?? "");
      formData.append("moon_phase", forecast.moon_phase ?? "");
    }

    if (image) formData.append("image", image);

    try {
      await api.post("/catch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notifySuccess("Уловът е запазен");
      setMsg("Запазено успешно");

      setTimeout(() => {
        resetForm();
        setActivePanel(null);
      }, 900);
    } catch (err) {
      notifyError(err, "Грешка при запазване на улова");
      setMsg("Грешка при запазване");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (e) => {
    e.stopPropagation();
    if (!lake?.id) return;
    navigate(`/lakes/${lake.id}`);
  };

  const renderForecastCard = () => {
    if (activePanel !== "forecast" || loading) return null;

    if (forecastLocked) {
      return (
        <PremiumLockedCard
          ref={activePanelRef}
          className="lake-popup-panel-card"
          compact
          title="Оценка на прогнозата: нужен е Premium"
          message="Отключете подробната риболовна прогноза, дневните детайли и автоматичните известия за водоема."
          onUpgrade={() => navigate("/billing")}
          onClose={() => {
            setForecastLocked(false);
            setActivePanel(null);
          }}
        />
      );
    }

    if (!forecast) return null;

    const selectedWeeklyForecast = weeklyForecast.find((day) => day.date === selectedWeeklyForecastDate) || weeklyForecast[0] || null;
    const displayedForecast = showWeeklyForecast && selectedWeeklyForecast ? selectedWeeklyForecast : forecast;
    const displayedBreakdown = displayedForecast?.breakdown || {};

    return (
      <div ref={activePanelRef} className="lake-popup-panel-card lake-popup-forecast-card">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setForecast(null);
            setShowWeeklyForecast(false);
            setActivePanel(null);
          }}
          className="lake-popup-inline-close"
        >
          <FaTimes />
        </button>

        <div className="lake-popup-section-heading">
          <div className="lake-popup-section-title">
            <FaChartBar />
            <span>Риболовна прогноза</span>
          </div>
          <p>Актуални условия и прогнозна оценка за този водоем.</p>
          <button
            type="button"
            className="lake-popup-weekly-toggle"
            onClick={toggleWeeklyForecast}
            disabled={loading || !hasValidCoords}
          >
            {showWeeklyForecast ? "Скрий седмичната прогноза" : "Покажи седмичната прогноза"}
          </button>
        </div>

        {showWeeklyForecast && (
          <div className="lake-popup-weekly-list">
            {weeklyForecast.length ? (
              (() => {
                const selectedDay =
                  weeklyForecast.find((day) => day.date === selectedWeeklyForecastDate) || weeklyForecast[0];

                return (
                  <>
                    <div className="lake-popup-weekly-date-grid">
                      {weeklyForecast.slice(0, 7).map((day) => {
                        const isActive = day.date === selectedDay?.date;
                        return (
                          <button
                            type="button"
                            key={day.date}
                            className={`lake-popup-weekly-date-button${isActive ? " active" : ""}`}
                            onClick={() => setSelectedWeeklyForecastDate(day.date)}
                          >
                            <span>{formatForecastDay(day.date)}</span>
                            <strong>{day.total_score ?? 0}%</strong>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="lake-popup-weekly-empty">
                {loading ? "Зареждане на седмичната прогноза..." : "Няма налична седмична прогноза."}
              </div>
            )}
          </div>
        )}

        <div className="lake-popup-score-grid">
          <div className="lake-popup-score-item">
            <div className="lake-popup-score-icon">
              <FaThermometerHalf />
            </div>
            <div>
              <div className="lake-popup-score-label">Оценка на времето</div>
              <div className="lake-popup-score-value">
                {displayedBreakdown.weather_score ?? 0}/100
              </div>
            </div>
          </div>

          <div className="lake-popup-score-item">
            <div className="lake-popup-score-icon">
              <FaMoon />
            </div>
            <div>
              <div className="lake-popup-score-label">Оценка на луната</div>
              <div className="lake-popup-score-value">
                {displayedBreakdown.moon_score ?? 0}/100
              </div>
            </div>
          </div>
        </div>

        <div className="lake-popup-total-score">
          <span>Общ индекс</span>
          <strong>{displayedForecast?.total_score ?? 0}%</strong>
        </div>

        <div className="lake-popup-metric-grid">
          <div className="lake-popup-metric-item">
            <span>Температура</span>
            <strong>{formatForecastNumber(displayedForecast?.temp, 1)}°C</strong>
          </div>
          <div className="lake-popup-metric-item">
            <span>Вятър</span>
            <strong>{formatForecastNumber(displayedForecast?.wind, 1)} м/с</strong>
          </div>
          <div className="lake-popup-metric-item">
            <span>Налягане</span>
            <strong>{formatForecastNumber(displayedForecast?.pressure, 0)} хПа</strong>
          </div>
          <div className="lake-popup-metric-item">
            <span>Влажност</span>
            <strong>{formatForecastNumber(displayedForecast?.humidity, 0)}%</strong>
          </div>
        </div>
      </div>
    );
  };

  const renderPremiumAlertCard = () => {
    if (activePanel !== "premium-alert" || !alertLocked) return null;

    return (
      <PremiumLockedCard
        ref={activePanelRef}
        className="lake-popup-panel-card"
        compact
        title="Умни известия: нужен е Premium"
        message="Отключете автоматични известия за прогноза за този водоем."
        bullets={["Дневни или седмични известия за прогноза", "Известия за любими водоеми"]}
        onUpgrade={() => navigate("/billing")}
        onClose={() => {
          setAlertLocked(false);
          setActivePanel(null);
        }}
      />
    );
  };

  const renderLogForm = () => {
    if (activePanel !== "log") return null;

    return (
      <form
        onSubmit={handleLogCatch}
        ref={activePanelRef}
        className="lake-popup-panel-card lake-popup-form-card"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePanel(null);
            resetForm();
          }}
          className="lake-popup-inline-close"
        >
          <FaTimes />
        </button>

        <div className="lake-popup-section-heading">
          <div className="lake-popup-section-title">
            <FaMapMarkedAlt />
            <span>Запиши улов</span>
          </div>
          <p>Запишете вид риба, тегло, време и бележки.</p>
        </div>

        <div className="lake-popup-form-grid">
          <div className="lake-popup-field">
            <label>Вид риба</label>
            <input
              type="text"
              placeholder="Вид риба"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              required
              disabled={saving}
              maxLength={100}
            />
          </div>

          <div className="lake-popup-field">
            <label>Тегло (кг)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Тегло (кг)"
              value={weight}
              onChange={(e) =>
                setWeight(e.target.value.replace(/[^0-9.]/g, ""))
              }
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className="lake-popup-field">
          <label>Време на улова</label>
          <input
            type="datetime-local"
            lang="bg-BG"
            value={catchTime}
            onChange={(e) => setCatchTime(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="lake-popup-field">
          <label>Бележки</label>
          <textarea
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))
            }
            rows={2}
            disabled={saving}
            maxLength={MAX_NOTES_LENGTH}
            placeholder="Стръв, метод, място, допълнителна информация..."
          />
          <div className="lake-popup-field-meta">
            {notes.length}/{MAX_NOTES_LENGTH}
          </div>
        </div>

        <div className="lake-popup-field">
          <label className="lake-popup-photo-label">
            <FaCamera />
            <span>Добави снимка</span>
          </label>

          {imagePreviewUrl ? (
            <div className="lake-popup-image-preview-wrap">
              <ZoomableImage
                src={imagePreviewUrl}
                alt="Преглед"
                imageClassName="lake-popup-image-preview"
              />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Сигурни ли сте, че искате да премахнете избраната снимка?")) {
                    setImage(null);
                  }
                }}
                disabled={saving}
                className="lake-popup-secondary-button"
              >
                Премахни снимката
              </button>
            </div>
          ) : (
            <label className="lake-popup-upload-box">
              <input
                style={{ display: "none" }}
                type="file"
                accept="image/*"
                disabled={saving}
                onChange={handleImageChange}
              />
              <span>Избери снимка</span>
              <small>JPG, PNG, WEBP до 5 MB</small>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="lake-popup-primary-submit"
        >
          {saving ? "Запазване..." : "Запази улова"}
        </button>

        {msg && (
          <div
            className={`lake-popup-message ${
              msg.includes("Error") ? "error" : "success"
            }`}
          >
            {msg}
          </div>
        )}
      </form>
    );
  };

  return (
    <>
      <div className="lake-popup-shell">
        <div className="lake-popup-header">
          <h3>{lake?.name}</h3>
          <div
            style={{
              color: "#64748b",
              lineHeight: 1.6,
              whiteSpace: descriptionExpanded ? "normal" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {descriptionExpanded ? popupDescription : popupDescriptionPreview}
          </div>
          {popupDescriptionCanExpand ? (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((value) => !value)}
              style={{
                marginTop: 8,
                border: "none",
                background: "transparent",
                color: "#2563eb",
                padding: 0,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              {descriptionExpanded ? "Покажи по-малко" : "Покажи повече"}
            </button>
          ) : null}
        </div>

        {!activePanel && (
        <div className="lake-popup-action-grid">
          <button
            type="button"
            onClick={getForecast}
            disabled={loading || !hasValidCoords}
            className={`lake-popup-action-button success ${
              activePanel === "forecast" ? "active" : ""
            }`}
          >
            <FaChartBar />
            <span>{loading ? "Зареждане..." : "Прогноза"}</span>
          </button>

          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              if (!forecast) {
                await getForecast();
              }
              await toggleWeeklyForecast(e);
            }}
            disabled={loading || !hasValidCoords}
            className="lake-popup-action-button forecast-week"
          >
            <FaCalendarAlt />
            <span>{loading ? "Зареждане..." : "Седмица"}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel((current) => (current === "log" ? null : "log"));
              if (!catchTime) setCatchTime(toLocalDateTimeValue(new Date()));
            }}
            className={`lake-popup-action-button primary ${
              activePanel === "log" ? "active" : ""
            }`}
          >
            <FaCamera />
            <span>Запиши улов</span>
          </button>

          <button
            type="button"
            onClick={toggleAlert}
            disabled={alertLoading}
            className={`lake-popup-action-button ${
              alertEnabled ? "dark" : "warning"
            }`}
          >
            <FaBell />
            <span>
              {alertLoading
                ? "Моля, изчакайте..."
                : alertEnabled
                  ? "Изключи известие"
                  : "Включи известие"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFavorite}
            disabled={alertLoading}
            className={`lake-popup-action-button ${
              favoriteEnabled ? "gold" : "muted"
            }`}
          >
            <FaStar />
            <span>{favoriteEnabled ? "Премахни от любими" : "Любими"}</span>
          </button>
        </div>
        )}

        {renderForecastCard()}
        {renderPremiumAlertCard()}
        {renderLogForm()}

        <button
          type="button"
          onClick={openDetails}
          className="lake-popup-details-button"
        >
          Виж детайли
        </button>
      </div>

      <style>{`
        .leaflet-popup {
          max-width: calc(100vw - 24px) !important;
        }

        .leaflet-popup-content-wrapper {
          max-width: calc(100vw - 24px);
          overflow: hidden;
        }

        .leaflet-popup-content {
          width: min(820px, calc(100vw - 44px)) !important;
          max-width: calc(100vw - 44px) !important;
          margin: 0 !important;
          overflow-x: hidden;
        }

        .lake-popup-shell {
          text-align: left;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .lake-popup-header {
          padding-right: 44px;
        }
        .lake-popup-header h3 {
          margin: 0 0 8px;
          font-size: 28px;
          line-height: 1.15;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .lake-popup-header p {
          margin: 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.65;
        }
        .lake-popup-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .lake-popup-action-button {
          border: none;
          border-radius: 16px;
          padding: 14px 16px;
          color: white;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease,
            opacity 0.18s ease;
        }

        .lake-popup-action-button.primary {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        }

        .lake-popup-action-button.success {
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
        }

        .lake-popup-action-button.warning {
          background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%);
        }

        .lake-popup-action-button.dark {
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
        }

        .lake-popup-action-button.gold {
          background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
        }

        .lake-popup-action-button.forecast-week {
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
        }

        .lake-popup-weekly-toggle {
          border: none;
          border-radius: 999px;
          background: #0f172a;
          color: white;
          font-weight: 800;
          padding: 9px 12px;
          cursor: pointer;
          margin-top: 10px;
        }

        .lake-popup-weekly-list {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
        }

        .lake-popup-weekly-date-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .lake-popup-weekly-date-button {
          border: 1px solid #dbe3ef;
          background: #fff;
          color: #0f172a;
          border-radius: 12px;
          padding: 8px 6px;
          cursor: pointer;
          display: grid;
          gap: 2px;
          text-align: center;
          font-weight: 900;
        }

        .lake-popup-weekly-date-button span {
          font-size: 11px;
          line-height: 1.2;
        }

        .lake-popup-weekly-date-button strong {
          font-size: 14px;
        }

        .lake-popup-weekly-date-button.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
        }

        .lake-popup-weekly-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
        }

        .lake-popup-weekly-row strong,
        .lake-popup-weekly-row span {
          display: block;
        }

        .lake-popup-weekly-row strong {
          color: #0f172a;
          font-size: 13px;
        }

        .lake-popup-weekly-row span,
        .lake-popup-weekly-row small {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
          display: block;
          line-height: 1.45;
        }

        .lake-popup-weekly-row.selected {
          background: #fff;
        }

        .lake-popup-weekly-row em {
          border-radius: 999px;
          font-style: normal;
          font-weight: 900;
          padding: 7px 10px;
          min-width: 52px;
          text-align: center;
        }

        .lake-popup-weekly-row em.great {
          background: #dcfce7;
          color: #166534;
        }

        .lake-popup-weekly-row em.good {
          background: #ecfeff;
          color: #0f766e;
        }

        .lake-popup-weekly-row em.average {
          background: #fff7ed;
          color: #9a3412;
        }

        .lake-popup-weekly-row em.weak {
          background: #fef2f2;
          color: #991b1b;
        }

        .lake-popup-weekly-empty {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          padding: 10px;
          background: #f8fafc;
          border-radius: 12px;
        }


        .lake-popup-action-button.muted {
          background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
        }

        .lake-popup-action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.16);
        }

        .lake-popup-action-button.active {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6),
            0 16px 28px rgba(15, 23, 42, 0.18);
        }

        .lake-popup-action-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .lake-popup-details-button {
          width: 100%;
          margin-top: 12px;
          background: #111827;
          color: white;
          border: none;
          padding: 14px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-weight: 800;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
        }

        .lake-popup-premium-lock-card {
          background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 48%, #fff7ed 100%);
          border: 1px solid #bfdbfe;
          box-shadow: 0 18px 42px rgba(37, 99, 235, 0.16);
          overflow: hidden;
        }

        .lake-popup-premium-lock-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 35%),
            radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.16), transparent 32%);
          pointer-events: none;
        }

        .lake-popup-premium-lock-card > * {
          position: relative;
          z-index: 1;
        }

        .lake-popup-premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1d4ed8;
          color: white;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 14px;
        }

        .lake-popup-premium-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
          display: grid;
          place-items: center;
          font-size: 20px;
          margin-bottom: 12px;
        }

        .lake-popup-premium-lock-card h3 {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 20px;
        }

        .lake-popup-premium-lock-card p {
          margin: 0 0 16px;
          color: #475569;
          line-height: 1.55;
          font-weight: 650;
        }

        .lake-popup-premium-list {
          margin: 0 0 16px;
          padding-left: 18px;
          color: #334155;
          font-weight: 750;
          line-height: 1.7;
        }

        .lake-popup-premium-button {
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          padding: 12px 16px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
        }

        .lake-popup-panel-card,
        .lake-popup-forecast-card,
        .lake-popup-form-card {
          margin-top: 16px;
          background: white;
          padding: 20px;
          border-radius: 20px;
          position: relative;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
        }

        .lake-popup-inline-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lake-popup-section-heading {
          margin-bottom: 18px;
          padding-right: 40px;
        }

        .lake-popup-section-heading p {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.6;
          color: #64748b;
        }

        .lake-popup-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
        }

        .lake-popup-score-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .lake-popup-score-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lake-popup-score-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .lake-popup-score-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 700;
        }

        .lake-popup-score-value {
          font-size: 18px;
          color: #0f172a;
          font-weight: 800;
        }

        .lake-popup-total-score {
          margin-top: 16px;
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          color: white;
          border-radius: 18px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .lake-popup-total-score span {
          font-weight: 700;
        }

        .lake-popup-total-score strong {
          font-size: 28px;
          line-height: 1;
        }

        .lake-popup-metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .lake-popup-metric-item {
          padding: 13px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          min-width: 0;
        }

        .lake-popup-metric-item span {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .lake-popup-metric-item strong {
          display: block;
          font-size: 16px;
          color: #0f172a;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .lake-popup-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .lake-popup-field {
          margin-bottom: 14px;
        }

        .lake-popup-field label {
          display: block;
          font-size: 12px;
          margin-bottom: 7px;
          color: #475569;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .lake-popup-field input,
        .lake-popup-field textarea {
          width: 100%;
          padding: 13px 14px;
          border-radius: 14px;
          border: 1px solid #dbe5f0;
          background: #f8fafc;
          box-sizing: border-box;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.18s ease, background 0.18s ease,
            box-shadow 0.18s ease;
        }

        .lake-popup-field textarea {
          resize: vertical;
          min-height: 96px;
        }

        .lake-popup-field input:focus,
        .lake-popup-field textarea:focus {
          border-color: #93c5fd;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        .lake-popup-field-meta {
          font-size: 11px;
          color: #64748b;
          text-align: right;
          margin-top: 6px;
          font-weight: 700;
        }

        .lake-popup-photo-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .lake-popup-upload-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          min-height: 124px;
          padding: 18px;
          text-align: center;
          cursor: pointer;
          background: linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%);
          border: 1px dashed #bfdbfe;
          border-radius: 16px;
          box-sizing: border-box;
        }

        .lake-popup-upload-box input {
          display: none;
        }

        .lake-popup-upload-box span {
          font-size: 14px;
          font-weight: 800;
          color: #1d4ed8;
        }

        .lake-popup-upload-box small {
          font-size: 12px;
          color: #64748b;
        }

        .lake-popup-image-preview-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lake-popup-image-preview {
          width: 100%;
          max-height: 280px;
          object-fit: contain;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: white;
        }

        .lake-popup-secondary-button {
          width: 100%;
          background: #64748b;
          color: white;
          border: none;
          padding: 12px 14px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 800;
        }

        .lake-popup-primary-submit {
          width: 100%;
          background: linear-gradient(135deg, #0d6efd 0%, #38bdf8 100%);
          color: white;
          border: none;
          padding: 14px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-weight: 800;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
        }

        .lake-popup-primary-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .lake-popup-message {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
        }

        .lake-popup-message.success {
          background: #ecfdf5;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .lake-popup-message.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        @media (max-width: 900px) {
          .lake-popup-form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .leaflet-popup-content {
            width: calc(100vw - 40px) !important;
            max-width: calc(100vw - 40px) !important;
          }

          .lake-popup-header {
            padding-right: 30px;
          }

          .lake-popup-header h3 {
            font-size: 22px;
            overflow-wrap: anywhere;
          }

          .lake-popup-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .lake-popup-action-button,
          .lake-popup-details-button {
            min-width: 0;
            padding: 13px 10px;
            border-radius: 15px;
            font-size: 13px;
          }

          .lake-popup-action-button span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .lake-popup-panel-card,
          .lake-popup-forecast-card,
          .lake-popup-form-card {
            padding: 16px;
          }
        }


        @media (max-width: 640px) {
          .lake-popup-header {
            padding-right: 30px;
          }

          .lake-popup-header h3 {
            font-size: 20px;
            line-height: 1.15;
            margin-bottom: 6px;
            overflow-wrap: anywhere;
          }

          .lake-popup-header > div {
            font-size: 13px;
            line-height: 1.35 !important;
          }

          .lake-popup-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 14px;
          }

          .lake-popup-action-button,
          .lake-popup-details-button {
            min-width: 0;
            padding: 11px 8px;
            border-radius: 14px;
            font-size: 12px;
          }

          .lake-popup-action-button span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .lake-popup-panel-card,
          .lake-popup-forecast-card,
          .lake-popup-form-card {
            margin-top: 10px;
            padding: 12px;
            border-radius: 18px;
          }

          .lake-popup-inline-close {
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
          }

          .lake-popup-section-heading {
            margin-bottom: 10px;
            padding-right: 34px;
          }

          .lake-popup-section-heading p {
            margin-top: 4px;
            font-size: 12px;
            line-height: 1.35;
          }

          .lake-popup-section-title {
            gap: 8px;
            font-size: 16px;
          }

          .lake-popup-score-grid,
          .lake-popup-metric-grid,
          .lake-popup-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .lake-popup-score-item {
            padding: 10px;
            gap: 8px;
            border-radius: 14px;
          }

          .lake-popup-score-icon {
            width: 32px;
            height: 32px;
            border-radius: 12px;
          }

          .lake-popup-score-label,
          .lake-popup-metric-item span {
            font-size: 11px;
            margin-bottom: 2px;
          }

          .lake-popup-score-value {
            font-size: 16px;
          }

          .lake-popup-total-score {
            margin-top: 8px;
            padding: 12px;
            border-radius: 15px;
          }

          .lake-popup-total-score strong {
            font-size: 24px;
          }

          .lake-popup-metric-grid {
            margin-top: 8px;
          }

          .lake-popup-metric-item {
            padding: 9px 10px;
            border-radius: 14px;
          }

          .lake-popup-metric-item strong {
            font-size: 14px;
          }

          .lake-popup-field {
            margin-bottom: 9px;
          }

          .lake-popup-field label {
            font-size: 10px;
            margin-bottom: 5px;
          }

          .lake-popup-field input,
          .lake-popup-field textarea {
            padding: 10px 11px;
            border-radius: 13px;
            font-size: 13px;
          }

          .lake-popup-field textarea {
            min-height: 58px;
          }

          .lake-popup-upload-box {
            min-height: 58px;
            padding: 10px;
            border-radius: 13px;
            gap: 2px;
          }

          .lake-popup-upload-box small {
            display: none;
          }

          .lake-popup-primary-submit {
            padding: 11px 12px;
            border-radius: 14px;
            font-size: 13px;
          }
        }
      `}</style>
    </>
  );
};

export default LakePopup;