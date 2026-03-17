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
  FaWeightHanging,
  FaRegClock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

const MAX_NOTES_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const toLocalDateTimeValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const LakePopup = ({ lake, map }) => {
  const navigate = useNavigate();

  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [species, setSpecies] = useState("");
  const [weight, setWeight] = useState("");
  const [image, setImage] = useState(null);
  const [catchTime, setCatchTime] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  const [alertEnabled, setAlertEnabled] = useState(false);
  const [favoriteEnabled, setFavoriteEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  const statusLoadedLakeRef = useRef(null);

  const lakeLat = Number(lake?.latitude);
  const lakeLng = Number(lake?.longitude);
  const hasValidCoords = Number.isFinite(lakeLat) && Number.isFinite(lakeLng);

  useEffect(() => {
    if (!catchTime) setCatchTime(toLocalDateTimeValue(new Date()));
  }, [catchTime]);

  useEffect(() => {
    statusLoadedLakeRef.current = null;
    setForecast(null);
    setShowLogForm(false);
    setMsg("");
    setSpecies("");
    setWeight("");
    setImage(null);
    setCatchTime(toLocalDateTimeValue(new Date()));
    setNotes("");
  }, [lake?.id]);

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
        await api.delete(`/alerts/${lake.id}`);
        setAlertEnabled(false);
        notifySuccess("Alert disabled");
      } else {
        await api.post("/alerts", {
          water_body_id: lake.id,
          is_favorite: favoriteEnabled,
          notification_frequency: "daily",
          min_score: 0,
        });
        setAlertEnabled(true);
        notifySuccess("Alert enabled");
      }
    } catch (err) {
      notifyError(err, alertEnabled ? "Failed to disable alert" : "Failed to enable alert");
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
        await api.delete(`/favorites/${lake.id}`);
        setFavoriteEnabled(false);
        notifySuccess("Removed from favorites");
      } else {
        await api.post("/favorites", { water_body_id: lake.id });
        setFavoriteEnabled(true);
        notifySuccess("Added to favorites");
      }
    } catch (err) {
      notifyError(err, favoriteEnabled ? "Failed to remove favorite" : "Failed to add favorite");
    } finally {
      setAlertLoading(false);
    }
  };

  const getForecast = async () => {
    setShowLogForm(false);
    setMsg("");

    if (!lake?.id || !hasValidCoords) {
      notifyError(null, "Lake coordinates are not available");
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/forecast/${lakeLat}/${lakeLng}`);
      setForecast(res.data || null);

      if (map) {
        map.setView([lakeLat, lakeLng], map.getZoom(), { animate: true });
      }
    } catch (err) {
      notifyError(err, "Error fetching forecast");
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
      setMsg("Image must be 5 MB or smaller");
      notifyError(null, "Image must be 5 MB or smaller");
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
      setMsg("Species is required");
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setMsg("Weight must be greater than 0");
      return;
    }

    if (notes.length > MAX_NOTES_LENGTH) {
      setMsg(`Notes must be ${MAX_NOTES_LENGTH} characters or less`);
      return;
    }

    if (image && image.size > MAX_IMAGE_SIZE_BYTES) {
      setMsg("Image must be 5 MB or smaller");
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
      notifySuccess("Catch saved");
      setMsg("Saved successfully");

      setTimeout(() => {
        resetForm();
        setShowLogForm(false);
      }, 900);
    } catch (err) {
      notifyError(err, "Error saving catch");
      setMsg("Error saving");
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
    if (!forecast || loading) return null;

    return (
      <div className="lake-popup-forecast-card">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setForecast(null);
          }}
          className="lake-popup-inline-close"
        >
          <FaTimes />
        </button>

        <div className="lake-popup-section-title">
          <FaChartBar />
          <span>Fishing success analysis</span>
        </div>

        <div className="lake-popup-score-grid">
          <div className="lake-popup-score-item">
            <div className="lake-popup-score-icon">
              <FaThermometerHalf />
            </div>
            <div>
              <div className="lake-popup-score-label">Weather score</div>
              <div className="lake-popup-score-value">{forecast.breakdown?.weather_score ?? 0}/100</div>
            </div>
          </div>

          <div className="lake-popup-score-item">
            <div className="lake-popup-score-icon">
              <FaMoon />
            </div>
            <div>
              <div className="lake-popup-score-label">Moon score</div>
              <div className="lake-popup-score-value">{forecast.breakdown?.moon_score ?? 0}/100</div>
            </div>
          </div>
        </div>

        <div className="lake-popup-total-score">
          <span>Total index</span>
          <strong>{forecast.total_score ?? 0}%</strong>
        </div>
      </div>
    );
  };

  const renderLogForm = () => {
    if (!showLogForm) return null;

    return (
      <form onSubmit={handleLogCatch} className="lake-popup-form-card">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowLogForm(false);
            resetForm();
          }}
          className="lake-popup-inline-close"
        >
          <FaTimes />
        </button>

        <div className="lake-popup-section-title">
          <FaMapMarkedAlt />
          <span>Log catch</span>
        </div>

        <div className="lake-popup-form-grid">
          <div className="lake-popup-field">
            <label>Species</label>
            <input
              type="text"
              placeholder="Species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              required
              disabled={saving}
              maxLength={100}
            />
          </div>

          <div className="lake-popup-field">
            <label>Weight (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Weight (kg)"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))}
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className="lake-popup-field">
          <label>Catch time</label>
          <input
            type="datetime-local"
            value={catchTime}
            onChange={(e) => setCatchTime(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="lake-popup-field">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
            rows={4}
            disabled={saving}
            maxLength={MAX_NOTES_LENGTH}
            placeholder="Bait, method, spot, extra info..."
          />
          <div className="lake-popup-field-meta">{notes.length}/{MAX_NOTES_LENGTH}</div>
        </div>

        <div className="lake-popup-field">
          <label className="lake-popup-photo-label">
            <FaCamera />
            <span>Add photo</span>
          </label>

          {imagePreviewUrl ? (
            <div className="lake-popup-image-preview-wrap">
              <img src={imagePreviewUrl} alt="Preview" className="lake-popup-image-preview" />
              <button
                type="button"
                onClick={() => setImage(null)}
                disabled={saving}
                className="lake-popup-secondary-button"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <input type="file" accept="image/*" disabled={saving} onChange={handleImageChange} />
          )}

          <div className="lake-popup-field-meta">Maximum image size: 5 MB</div>
        </div>

        <button type="submit" disabled={saving} className="lake-popup-primary-submit">
          {saving ? "Saving..." : "Save catch"}
        </button>

        {msg && (
          <div className={`lake-popup-message ${msg.includes("Error") ? "error" : "success"}`}>
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
          <div className="lake-popup-badge">Lake overview</div>
          <h3>{lake?.name}</h3>
          <p>{lake?.description || "No description available."}</p>
        </div>

        <div className="lake-popup-quick-stats">
          <div className="lake-popup-quick-stat">
            <FaMapMarkedAlt />
            <span>{hasValidCoords ? "Map point available" : "Map point unavailable"}</span>
          </div>
          <div className="lake-popup-quick-stat">
            <FaWeightHanging />
            <span>Catch logging ready</span>
          </div>
          <div className="lake-popup-quick-stat">
            <FaRegClock />
            <span>Forecast supported</span>
          </div>
        </div>

        <div className="lake-popup-action-grid">
          <button onClick={getForecast} disabled={loading || !hasValidCoords} className="lake-popup-action-button success">
            <FaChartBar />
            <span>{loading ? "Loading..." : "Forecast"}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLogForm(true);
              if (!catchTime) setCatchTime(toLocalDateTimeValue(new Date()));
            }}
            className="lake-popup-action-button primary"
          >
            <FaCamera />
            <span>Log Catch</span>
          </button>

          <button
            onClick={toggleAlert}
            disabled={alertLoading}
            className={`lake-popup-action-button ${alertEnabled ? "dark" : "warning"}`}
          >
            <FaBell />
            <span>{alertLoading ? "Please wait..." : alertEnabled ? "Disable Alert" : "Enable Alert"}</span>
          </button>

          <button
            onClick={toggleFavorite}
            disabled={alertLoading}
            className={`lake-popup-action-button ${favoriteEnabled ? "gold" : "muted"}`}
          >
            <FaStar />
            <span>{favoriteEnabled ? "Unfavorite" : "Favorite"}</span>
          </button>
        </div>

        <button onClick={openDetails} className="lake-popup-details-button">
          View Details
        </button>

        {renderForecastCard()}
        {renderLogForm()}
      </div>

      <style>{`
        .lake-popup-shell {
          text-align: left;
          min-width: 300px;
        }

        .lake-popup-header {
          padding-right: 44px;
        }

        .lake-popup-badge {
          display: inline-block;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 10px;
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

        .lake-popup-quick-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 18px;
        }

        .lake-popup-quick-stat {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .lake-popup-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
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

        .lake-popup-action-button.muted {
          background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
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

        .lake-popup-forecast-card,
        .lake-popup-form-card {
          margin-top: 16px;
          background: white;
          padding: 18px;
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

        .lake-popup-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 16px;
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
          padding: 12px 13px;
          border-radius: 14px;
          border: 1px solid #dbe5f0;
          background: #f8fafc;
          box-sizing: border-box;
          font-size: 14px;
          color: #0f172a;
          outline: none;
        }

        .lake-popup-field textarea {
          resize: vertical;
          min-height: 96px;
        }

        .lake-popup-field input:focus,
        .lake-popup-field textarea:focus {
          border-color: #93c5fd;
          background: white;
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
          .lake-popup-quick-stats {
            grid-template-columns: 1fr;
          }

          .lake-popup-action-grid,
          .lake-popup-form-grid,
          .lake-popup-score-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .lake-popup-header h3 {
            font-size: 22px;
          }
        }
      `}</style>
    </>
  );
};

export default LakePopup;