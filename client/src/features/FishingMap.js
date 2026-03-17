import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  GeoJSON,
} from "react-leaflet";
import {
  FaFish,
  FaSearch,
  FaTimes,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaLayerGroup,
  FaSlidersH,
  FaLocationArrow,
} from "react-icons/fa";
import MapRecenter from "../components/MapRecenter";
import LakePopup from "./LakePopUp";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const BULGARIA_CENTER = [42.7339, 25.4858];
const BULGARIA_ZOOM = 7;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text, query) => {
  const t = String(text || "");
  const q = String(query || "").trim();
  if (!q) return t;

  const re = new RegExp(escapeRegExp(q), "ig");
  const parts = [];
  let lastIndex = 0;

  t.replace(re, (match, offset) => {
    parts.push(t.slice(lastIndex, offset));
    parts.push(
      <mark
        key={`${offset}-${match}`}
        style={{
          background: "#dbeafe",
          color: "#1d4ed8",
          padding: "0 4px",
          borderRadius: "6px",
        }}
      >
        {t.slice(offset, offset + match.length)}
      </mark>,
    );
    lastIndex = offset + match.length;
    return match;
  });

  parts.push(t.slice(lastIndex));
  return parts;
};

const getDisplayDescription = (text) => {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.toLowerCase().startsWith("imported from openstreetmap")) return "";
  return value;
};

const truncate = (text, max = 90) => {
  const value = String(text || "").trim();
  if (!value) return "No description available.";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
};

const getGeometryType = (geometry) => geometry?.type || null;

const hasRenderableGeometry = (geometry) => {
  const type = getGeometryType(geometry);
  return ["Polygon", "MultiPolygon", "LineString", "MultiLineString"].includes(
    type,
  );
};

const formatWaterBodyType = (type) => {
  const value = String(type || "")
    .trim()
    .toLowerCase();
  if (!value) return "Water body";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const shouldShowMarker = (lake) =>
  ["lake", "reservoir"].includes(String(lake?.type || "").toLowerCase()) &&
  Number.isFinite(Number(lake?.latitude)) &&
  Number.isFinite(Number(lake?.longitude));

const createLakeIcon = (selected) =>
  L.divIcon({
    className: "",
    html: `
      <div style="
        width: ${selected ? 24 : 20}px;
        height: ${selected ? 24 : 20}px;
        border-radius: 999px;
        background: ${
          selected
            ? "linear-gradient(135deg,#0f172a,#2563eb)"
            : "linear-gradient(135deg,#0d6efd,#38bdf8)"
        };
        border: 3px solid white;
        box-shadow: 0 10px 24px rgba(15,23,42,0.28);
        position: relative;
      ">
        <div style="
          position:absolute;
          left:50%;
          bottom:-8px;
          transform:translateX(-50%);
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 10px solid ${selected ? "#1d4ed8" : "#38bdf8"};
        "></div>
      </div>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 30],
    popupAnchor: [0, -30],
  });

function FishingMap() {
  const [openingLakeFromRoute, setOpeningLakeFromRoute] = useState(false);
  const [waterBodies, setWaterBodies] = useState([]);
  const [serverError, setServerError] = useState(null);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLake, setActiveLake] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [showMapLoadingOverlay, setShowMapLoadingOverlay] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [distanceKm, setDistanceKm] = useState("ALL");
  const [sortBy, setSortBy] = useState("default");
  const [mapUserLocation, setMapUserLocation] = useState(null);

  const overlayOpen = Boolean(activeLake);
  const location = useLocation();
  const navigate = useNavigate();
  const lakeIdFromRoute = location.state?.lakeId;
  const normalizedLakeIdFromRoute =
    lakeIdFromRoute === null ||
    lakeIdFromRoute === undefined ||
    lakeIdFromRoute === ""
      ? null
      : String(lakeIdFromRoute);

  const routeLakeHandledRef = useRef(false);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    routeLakeHandledRef.current = false;
  }, [normalizedLakeIdFromRoute]);

  const focusLake = useCallback(
    (lake) => {
      if (!lake) return;

      setActiveLake(lake);
      setIsMobileSidebarOpen(false);

      if (
        mapInstance &&
        Number.isFinite(Number(lake.latitude)) &&
        Number.isFinite(Number(lake.longitude))
      ) {
        mapInstance.flyTo(
          [Number(lake.latitude), Number(lake.longitude)],
          Math.max(mapInstance.getZoom(), 11),
          { duration: 1.2 },
        );
      }
    },
    [mapInstance],
  );

  const fetchWaterBodyById = useCallback(async (waterBodyId) => {
    const res = await api.get(`/water-bodies/${waterBodyId}`);
    return res.data || null;
  }, []);

  const fetchWaterBodiesInBounds = useCallback(
    async ({ silent = false } = {}) => {
      if (!mapInstance || openingLakeFromRoute) return;

      const requestId = ++latestRequestIdRef.current;
      const bounds = mapInstance.getBounds();
      const zoom = mapInstance.getZoom();

      setLoadingWaterBodies(true);
      setServerError(null);

      try {
        const res = await api.get("/water-bodies/in-bounds", {
          params: {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
            zoom,
          },
        });

        if (requestId !== latestRequestIdRef.current) return;
        setWaterBodies(res.data || []);
      } catch (err) {
        if (requestId !== latestRequestIdRef.current) return;
        setServerError("Failed to load water bodies in bounds");
        if (!silent) {
          notifyError(err, "Failed to load water bodies in bounds");
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoadingWaterBodies(false);
        }
      }
    },
    [mapInstance, openingLakeFromRoute],
  );

  const searchWaterBodiesGlobally = useCallback(
    async (query) => {
      const trimmed = String(query || "").trim();

      if (!trimmed) {
        fetchWaterBodiesInBounds();
        return;
      }

      const requestId = ++latestRequestIdRef.current;

      setLoadingWaterBodies(true);
      setServerError(null);

      try {
        const res = await api.get("/water-bodies/search", {
          params: { q: trimmed },
        });

        if (requestId !== latestRequestIdRef.current) return;
        setWaterBodies(res.data || []);
      } catch (err) {
        if (requestId !== latestRequestIdRef.current) return;
        setServerError("Search failed");
        notifyError(err, "Search failed");
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoadingWaterBodies(false);
        }
      }
    },
    [fetchWaterBodiesInBounds],
  );

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;

    if (!searchTerm.trim()) {
      fetchWaterBodiesInBounds({ silent: true });
    }

    const handleMoveEnd = () => {
      if (!searchTerm.trim() && !openingLakeFromRoute) {
        fetchWaterBodiesInBounds({ silent: true });
      }
    };

    mapInstance.on("moveend", handleMoveEnd);
    mapInstance.on("zoomend", handleMoveEnd);

    return () => {
      mapInstance.off("moveend", handleMoveEnd);
      mapInstance.off("zoomend", handleMoveEnd);
    };
  }, [mapInstance, fetchWaterBodiesInBounds, searchTerm, openingLakeFromRoute]);

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;

    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchWaterBodiesGlobally(searchTerm);
      } else {
        fetchWaterBodiesInBounds({ silent: true });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    searchTerm,
    mapInstance,
    searchWaterBodiesGlobally,
    fetchWaterBodiesInBounds,
    openingLakeFromRoute,
  ]);

  useEffect(() => {
    const handleRouteLakeOpen = async () => {
      if (!normalizedLakeIdFromRoute || routeLakeHandledRef.current) return;

      setOpeningLakeFromRoute(true);

      const existing = waterBodies.find(
        (w) => String(w.id) === normalizedLakeIdFromRoute,
      );

      if (existing) {
        routeLakeHandledRef.current = true;
        setSearchTerm("");
        focusLake(existing);
        navigate(location.pathname, { replace: true, state: {} });

        setTimeout(() => {
          setOpeningLakeFromRoute(false);
        }, 1200);
        return;
      }

      try {
        setLoadingWaterBodies(true);
        const exactLake = await fetchWaterBodyById(normalizedLakeIdFromRoute);

        if (!exactLake) {
          setOpeningLakeFromRoute(false);
          return;
        }

        routeLakeHandledRef.current = true;
        setSearchTerm("");
        setWaterBodies((prev) => {
          const alreadyExists = prev.some(
            (w) => String(w.id) === String(exactLake.id),
          );
          return alreadyExists ? prev : [exactLake, ...prev];
        });
        focusLake(exactLake);
        navigate(location.pathname, { replace: true, state: {} });

        setTimeout(() => {
          setOpeningLakeFromRoute(false);
        }, 1200);
      } catch (err) {
        notifyError(err, "Failed to open the selected lake");
        setOpeningLakeFromRoute(false);
      } finally {
        setLoadingWaterBodies(false);
      }
    };

    handleRouteLakeOpen();
  }, [
    normalizedLakeIdFromRoute,
    waterBodies,
    fetchWaterBodyById,
    focusLake,
    navigate,
    location.pathname,
  ]);

  useEffect(() => {
    let timer;
    const isLoading = !mapReady || tilesLoading || loadingWaterBodies;

    if (isLoading) {
      timer = setTimeout(() => setShowMapLoadingOverlay(true), 200);
    } else {
      setShowMapLoadingOverlay(false);
    }

    return () => clearTimeout(timer);
  }, [mapReady, tilesLoading, loadingWaterBodies]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (activeLake) {
          setActiveLake(null);
          return;
        }
        if (isMobileSidebarOpen) {
          setIsMobileSidebarOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLake, isMobileSidebarOpen]);

  const enrichedLakes = useMemo(() => {
    return waterBodies.map((lake) => {
      const lat = Number(lake.latitude);
      const lng = Number(lake.longitude);

      let computedDistanceKm = null;

      if (
        userLocation &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Number.isFinite(userLocation.latitude) &&
        Number.isFinite(userLocation.longitude)
      ) {
        computedDistanceKm = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          lat,
          lng,
        );
      }

      return {
        ...lake,
        distanceKm: computedDistanceKm,
      };
    });
  }, [waterBodies, userLocation]);

  const filteredLakes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    let result = enrichedLakes.filter((lake) => {
      const displayDescription = getDisplayDescription(lake.description);

      const matchesSearch =
        !q ||
        lake.name?.toLowerCase().includes(q) ||
        displayDescription?.toLowerCase().includes(q) ||
        lake.type?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (distanceKm !== "ALL") {
        if (!Number.isFinite(lake.distanceKm)) return false;
        return lake.distanceKm <= Number(distanceKm);
      }

      return true;
    });

    result = result.filter(
      (lake, index, self) =>
        index ===
        self.findIndex(
          (item) =>
            String(item.name || "")
              .trim()
              .toLowerCase() ===
            String(lake.name || "")
              .trim()
              .toLowerCase(),
        ),
    );

    if (sortBy === "nearest") {
      result = [...result].sort((a, b) => {
        const aDistance = Number.isFinite(a.distanceKm)
          ? a.distanceKm
          : Number.POSITIVE_INFINITY;
        const bDistance = Number.isFinite(b.distanceKm)
          ? b.distanceKm
          : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
    } else if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    }

    return result;
  }, [enrichedLakes, searchTerm, distanceKm, sortBy]);

  const geometryCount = useMemo(
    () =>
      waterBodies.filter((lake) => hasRenderableGeometry(lake.boundary)).length,
    [waterBodies],
  );

  const markerCount = useMemo(
    () => waterBodies.filter((lake) => shouldShowMarker(lake)).length,
    [waterBodies],
  );

  const visibleMarkerCount = useMemo(
    () => filteredLakes.filter((lake) => shouldShowMarker(lake)).length,
    [filteredLakes],
  );

  const handleLocateBulgaria = () => {
    if (!mapInstance) return;
    setSearchTerm("");
    setActiveLake(null);
    mapInstance.flyTo(BULGARIA_CENTER, BULGARIA_ZOOM, { duration: 1.2 });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      const message = "Geolocation is not supported in this browser";
      setLocationError(message);
      notifyError(null, message);
      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserLocation(nextLocation);
        setLocationLoading(false);

        if (distanceKm === "ALL") {
          setDistanceKm("100");
        }

        if (sortBy === "default") {
          setSortBy("nearest");
        }

        notifySuccess("Location detected for distance filtering");
      },
      (error) => {
        let message = "Unable to get your location";

        if (error.code === 1) {
          message = "Location access was denied";
        } else if (error.code === 2) {
          message = "Location is currently unavailable";
        } else if (error.code === 3) {
          message = "Location request timed out";
        }

        setLocationError(message);
        setLocationLoading(false);
        notifyError(null, message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const handleZoomToMyLocation = () => {
    if (!navigator.geolocation) {
      notifyError(null, "Geolocation is not supported in this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setMapUserLocation(nextLocation);
        setSearchTerm("");
        setActiveLake(null);

        if (mapInstance) {
          mapInstance.flyTo(
            [nextLocation.latitude, nextLocation.longitude],
            10,
            {
              duration: 1.2,
            },
          );
        }
      },
      (error) => {
        let message = "Unable to get your location";

        if (error.code === 1) {
          message = "Location access was denied";
        } else if (error.code === 2) {
          message = "Location is currently unavailable";
        } else if (error.code === 3) {
          message = "Location request timed out";
        }

        notifyError(null, message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const clearDistanceFilter = () => {
    setUserLocation(null);
    setLocationError("");
    setDistanceKm("ALL");
    if (sortBy === "nearest") {
      setSortBy("default");
    }
  };

  const selectedLakeDistance = useMemo(() => {
    if (!activeLake || !userLocation) return null;

    const lat = Number(activeLake.latitude);
    const lng = Number(activeLake.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return getDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lng,
    );
  }, [activeLake, userLocation]);

  return (
    <>
      <div className="fishing-map-page">
        <button
          className={`map-sidebar-handle ${isMobileSidebarOpen ? "open" : ""}`}
          onClick={() => setIsMobileSidebarOpen((v) => !v)}
          aria-label={
            isMobileSidebarOpen
              ? "Close locations sidebar"
              : "Open locations sidebar"
          }
        >
          <span>{isMobileSidebarOpen ? "‹" : "›"}</span>
        </button>

        {isMobileSidebarOpen && (
          <button
            className="map-sidebar-backdrop"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close locations sidebar"
          />
        )}

        <aside className={`map-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
          <div className="map-sidebar-header">
            <div className="map-sidebar-brand">
              <div className="map-sidebar-brand-icon">
                <FaFish />
              </div>
              <div>
                <h2>Fishing Atlas</h2>
                <p>
                  Explore water bodies, inspect boundaries, and open each
                  location&apos;s fishing details.
                </p>
              </div>
            </div>

            <div className="map-sidebar-hero-stats">
              <div className="map-hero-stat">
                <span>{waterBodies.length}</span>
                <small>{searchTerm.trim() ? "Results" : "Visible"}</small>
              </div>
              <div className="map-hero-stat">
                <span>{markerCount}</span>
                <small>Markers</small>
              </div>
              <div className="map-hero-stat">
                <span>{geometryCount}</span>
                <small>Areas</small>
              </div>
            </div>
          </div>

          <div className="map-sidebar-search-section">
            <div className="map-search-box">
              <FaSearch className="map-search-icon" />
              <input
                type="text"
                placeholder="Search all lakes, types, descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {loadingWaterBodies && searchTerm.trim() && (
                <span className="map-search-loading">Loading...</span>
              )}
              {searchTerm && !loadingWaterBodies && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="map-search-clear"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            <div className="map-controls-grid">
              <button
                onClick={handleUseMyLocation}
                disabled={locationLoading}
                className="map-control-button primary"
              >
                <FaLocationArrow />
                <span>
                  {locationLoading ? "Locating..." : "Use my location"}
                </span>
              </button>

              <select
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="map-control-select"
              >
                <option value="ALL">All distances</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
                <option value="200">Within 200 km</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="map-control-select"
              >
                <option value="default">Default order</option>
                <option value="nearest">Nearest first</option>
                <option value="name">A–Z</option>
              </select>

              <button
                onClick={clearDistanceFilter}
                className="map-control-button secondary"
                disabled={
                  !userLocation && distanceKm === "ALL" && sortBy !== "nearest"
                }
              >
                <FaTimes />
                <span>Clear location filter</span>
              </button>
            </div>

            {(userLocation || locationError) && (
              <div
                className={`map-location-status ${locationError ? "error" : "success"}`}
              >
                {locationError ? (
                  <span>{locationError}</span>
                ) : (
                  <span>
                    Location active
                    {distanceKm !== "ALL"
                      ? ` • showing locations within ${distanceKm} km`
                      : ""}
                  </span>
                )}
              </div>
            )}

            <div className="map-filter-row">
              <div className="map-pill">
                {filteredLakes.length} result
                {filteredLakes.length === 1 ? "" : "s"}
              </div>
              <div className="map-pill map-pill-icon">
                <FaMapMarkerAlt />
                {visibleMarkerCount} visible markers
              </div>
              <div className="map-pill map-pill-icon">
                <FaLayerGroup />
                {geometryCount} geometries
              </div>
            </div>
          </div>

          {serverError && (
            <div className="map-server-error">
              <FaExclamationTriangle />
              <span>{serverError}</span>
            </div>
          )}

          <div className="map-sidebar-list">
            {loadingWaterBodies && !searchTerm.trim() ? (
              <div className="map-empty-state">Loading locations...</div>
            ) : waterBodies.length === 0 ? (
              <div className="map-empty-state">
                {searchTerm.trim()
                  ? "No locations found."
                  : "No water bodies visible in this area."}
              </div>
            ) : filteredLakes.length === 0 ? (
              <div className="map-empty-state">
                No locations match your filters.
              </div>
            ) : (
              filteredLakes.map((lake) => {
                const selected = activeLake?.id === lake.id;
                const distanceLabel = formatDistance(lake.distanceKm);

                return (
                  <button
                    key={lake.id}
                    onClick={() => focusLake(lake)}
                    className={`lake-list-card ${selected ? "selected" : ""}`}
                  >
                    <div className="lake-list-card-top">
                      <div className="lake-list-card-pin">
                        <FaMapMarkerAlt />
                      </div>

                      <div className="lake-list-card-main">
                        <div className="lake-list-card-title">
                          {highlightText(lake.name, searchTerm)}
                        </div>
                        <div className="lake-list-card-description">
                          {truncate(
                            getDisplayDescription(lake.description),
                            88,
                          )}
                        </div>
                      </div>

                      {selected && (
                        <div className="lake-list-card-badge">Selected</div>
                      )}
                    </div>

                    <div className="lake-list-card-meta">
                      <span className="lake-meta-chip">
                        <FaSlidersH />
                        Water profile
                      </span>

                      {lake.type && (
                        <span className="lake-meta-chip">
                          {formatWaterBodyType(lake.type)}
                        </span>
                      )}

                      {shouldShowMarker(lake) && (
                        <span className="lake-meta-chip">
                          Coordinates ready
                        </span>
                      )}

                      {hasRenderableGeometry(lake.boundary) && (
                        <span className="lake-meta-chip">
                          Geometry available
                        </span>
                      )}

                      {distanceLabel && (
                        <span className="lake-meta-chip distance">
                          {distanceLabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="map-main-panel">
          <MapContainer
            center={BULGARIA_CENTER}
            zoom={BULGARIA_ZOOM}
            maxZoom={19}
            className="fishing-map-canvas"
            whenReady={(event) => {
              setMapInstance(event.target);
              setMapReady(true);
            }}
          >
            <MapRecenter activeLake={activeLake} />

            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles © Esri"
              maxZoom={19}
              eventHandlers={{
                loading: () => setTilesLoading(true),
                load: () => setTilesLoading(false),
              }}
            />

            {mapUserLocation && (
              <CircleMarker
                center={[mapUserLocation.latitude, mapUserLocation.longitude]}
                radius={10}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#2563eb",
                  fillOpacity: 1,
                }}
              />
            )}

            {filteredLakes.map((lake) => (
              <React.Fragment key={lake.id}>
                {shouldShowMarker(lake) && (
                  <Marker
                    position={[Number(lake.latitude), Number(lake.longitude)]}
                    icon={createLakeIcon(activeLake?.id === lake.id)}
                    eventHandlers={{ click: () => focusLake(lake) }}
                  />
                )}

                {hasRenderableGeometry(lake.boundary) && (
                  <GeoJSON
                    data={lake.boundary}
                    style={() => ({
                      color: activeLake?.id === lake.id ? "#0f172a" : "#2563eb",
                      fillColor:
                        activeLake?.id === lake.id ? "#38bdf8" : "#60a5fa",
                      fillOpacity: activeLake?.id === lake.id ? 0.42 : 0.2,
                      weight: activeLake?.id === lake.id ? 4 : 2,
                    })}
                    eventHandlers={{
                      click: () => focusLake(lake),
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </MapContainer>

          <div className="map-floating-actions">
            <button
              onClick={handleZoomToMyLocation}
              className="map-floating-button"
            >
              <FaLocationArrow />
              My location
            </button>

            <button
              onClick={handleLocateBulgaria}
              className="map-floating-button"
            >
              <FaLocationArrow />
              Bulgaria
            </button>

            {activeLake && (
              <button
                onClick={() => setActiveLake(null)}
                className="map-floating-button secondary"
              >
                <FaTimes />
                Clear selection
              </button>
            )}
          </div>

          {activeLake && (
            <div className="map-selected-preview">
              <div className="map-selected-preview-label">
                Selected location
              </div>
              <div className="map-selected-preview-title">
                {activeLake.name}
              </div>
              <div className="map-selected-preview-text">
                {truncate(getDisplayDescription(activeLake.description), 110)}
              </div>
              {selectedLakeDistance !== null && (
                <div className="map-selected-preview-distance">
                  {formatDistance(selectedLakeDistance)}
                </div>
              )}
            </div>
          )}

          {showMapLoadingOverlay && (
            <div className="map-loading-overlay">Loading map...</div>
          )}

          {overlayOpen && (
            <div
              onClick={() => setActiveLake(null)}
              className="lake-modal-backdrop"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="lake-modal-card"
              >
                <button
                  onClick={() => setActiveLake(null)}
                  className="lake-modal-close"
                >
                  ×
                </button>
                <LakePopup lake={activeLake} map={mapInstance} />
              </div>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .fishing-map-page {
          display: flex;
          height: calc(100vh - 60px);
          width: 100%;
          position: relative;
          overflow: hidden;
          background: #edf3f9;
        }

        .map-sidebar-handle {
          display: none;
        }

        .map-sidebar-backdrop {
          position: absolute;
          inset: 0;
          z-index: 1650;
          background: rgba(15, 23, 42, 0.26);
          border: none;
          padding: 0;
          margin: 0;
          display: none;
        }

        .map-sidebar {
          width: 390px;
          min-width: 390px;
          background: rgba(255, 255, 255, 0.96);
          overflow-y: auto;
          z-index: 1700;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #dbe5f0;
          backdrop-filter: blur(14px);
          box-shadow: 8px 0 30px rgba(15, 23, 42, 0.08);
        }

        .map-sidebar-header {
          padding: 24px 20px 20px;
          background: linear-gradient(135deg, #0d6efd 0%, #38bdf8 100%);
          color: white;
        }

        .map-sidebar-brand {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .map-sidebar-brand-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        }

        .map-sidebar-brand h2 {
          margin: 0 0 6px;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .map-sidebar-brand p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          opacity: 0.95;
          max-width: 270px;
        }

        .map-sidebar-hero-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 18px;
        }

        .map-hero-stat {
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          padding: 14px 10px;
          text-align: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .map-hero-stat span {
          display: block;
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 2px;
        }

        .map-hero-stat small {
          font-size: 12px;
          opacity: 0.92;
        }

        .map-sidebar-search-section {
          padding: 16px;
          border-bottom: 1px solid #eaf0f6;
          background: rgba(255, 255, 255, 0.94);
          position: sticky;
          top: 0;
          z-index: 2;
          backdrop-filter: blur(10px);
        }

        .map-search-box {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border-radius: 18px;
          padding: 13px 15px;
          border: 1px solid #dbe5f0;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.8);
          gap: 10px;
        }

        .map-search-box input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
        }

        .map-search-box input::placeholder {
          color: #94a3b8;
        }

        .map-search-icon {
          color: #64748b;
          flex-shrink: 0;
          font-size: 15px;
        }

        .map-search-loading {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          flex-shrink: 0;
        }

        .map-search-clear {
          border: none;
          background: transparent;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          padding: 0;
          flex-shrink: 0;
        }

        .map-controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        .map-control-button,
        .map-control-select {
          min-height: 46px;
          border-radius: 16px;
          border: 1px solid #dbe5f0;
          font-size: 13px;
          font-weight: 800;
          padding: 0 14px;
          background: white;
          color: #0f172a;
        }

        .map-control-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
        }

        .map-control-button.primary {
          background: linear-gradient(135deg, #0d6efd 0%, #38bdf8 100%);
          border: none;
          color: white;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
        }

        .map-control-button.secondary {
          background: #f8fafc;
          color: #475569;
        }

        .map-control-button:disabled,
        .map-control-select:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .map-location-status {
          margin-top: 10px;
          padding: 11px 13px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 700;
        }

        .map-location-status.success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .map-location-status.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .map-filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .map-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }

        .map-pill-icon {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .map-server-error {
          margin: 14px 16px 0;
          padding: 12px 14px;
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 14px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .map-sidebar-list {
          flex: 1;
          padding: 14px;
          background: linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
        }

        .map-empty-state {
          padding: 18px;
          color: #64748b;
          font-size: 14px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
        }

        .lake-list-card {
          width: 100%;
          margin-bottom: 14px;
          text-align: left;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          cursor: pointer;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          padding: 16px;
          transition: all 0.18s ease;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
        }

        .lake-list-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.1);
          border-color: #bfdbfe;
        }

        .lake-list-card.selected {
          border: 1px solid #93c5fd;
          background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
          box-shadow: 0 16px 30px rgba(59, 130, 246, 0.14);
        }

        .lake-list-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .lake-list-card-pin {
          width: 40px;
          height: 40px;
          border-radius: 15px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .lake-list-card-main {
          flex: 1;
          min-width: 0;
        }

        .lake-list-card-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
          line-height: 1.3;
        }

        .lake-list-card-description {
          font-size: 13px;
          line-height: 1.55;
          color: #64748b;
        }

        .lake-list-card-badge {
          flex-shrink: 0;
          background: #2563eb;
          color: white;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }

        .lake-list-card-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .lake-meta-chip {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 11px;
          color: #475569;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .lake-meta-chip.distance {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .map-main-panel {
          flex: 1;
          position: relative;
          min-width: 0;
          background: #dfeaf4;
        }

        .fishing-map-canvas {
          height: 100%;
          width: 100%;
        }

        .map-floating-actions {
          position: absolute;
          right: 18px;
          bottom: 64px;
          z-index: 1200;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: calc(100% - 36px);
        }

        .map-floating-button {
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.94);
          color: #0f172a;
          padding: 11px 14px;
          font-weight: 800;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          white-space: nowrap;
          backdrop-filter: blur(10px);
        }

        .map-floating-button.secondary {
          background: rgba(15, 23, 42, 0.92);
          color: white;
          border-color: rgba(15, 23, 42, 0.92);
        }

        .map-selected-preview {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 1100;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 14px 16px;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.14);
          max-width: 340px;
          backdrop-filter: blur(12px);
        }

        .map-selected-preview-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 700;
        }

        .map-selected-preview-title {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 8px;
          font-size: 16px;
        }

        .map-selected-preview-text {
          font-size: 13px;
          color: #64748b;
          line-height: 1.55;
        }

        .map-selected-preview-distance {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
        }

        .map-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.46);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          font-size: 14px;
          color: #334155;
          font-weight: 800;
          backdrop-filter: blur(3px);
        }

        .lake-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          backdrop-filter: blur(4px);
        }

        .lake-modal-card {
          width: min(640px, calc(100vw - 32px));
          max-height: calc(100vh - 96px);
          overflow-y: auto;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.32);
          position: relative;
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .lake-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          color: #475569;
          font-size: 20px;
          line-height: 1;
        }

        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16) !important;
          border-radius: 18px !important;
          overflow: hidden;
        }

        .leaflet-control-zoom a {
          width: 40px !important;
          height: 40px !important;
          line-height: 40px !important;
          background: rgba(255, 255, 255, 0.98) !important;
          color: #0f172a !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.84) !important;
          border-radius: 12px 0 0 0;
          padding: 4px 8px !important;
        }

        @media (max-width: 1100px) {
          .map-sidebar {
            width: 360px;
            min-width: 360px;
          }

          .map-controls-grid {
            grid-template-columns: 1fr;
          }

          .map-selected-preview {
            max-width: 300px;
          }
        }

        @media (max-width: 900px) {
          .map-sidebar-handle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 50%;
            left: 0;
            z-index: 1805;
            width: 34px;
            height: 68px;
            border: none;
            border-radius: 0 18px 18px 0;
            background: linear-gradient(135deg, #0d6efd 0%, #38bdf8 100%);
            color: white;
            box-shadow: 0 14px 26px rgba(15, 23, 42, 0.18);
            cursor: pointer;
            transition: left 0.25s ease, transform 0.25s ease, box-shadow 0.2s ease;
            transform: translateY(-50%);
          }

          .map-sidebar-handle:hover {
            box-shadow: 0 18px 30px rgba(15, 23, 42, 0.24);
          }

          .map-sidebar-handle span {
            font-size: 28px;
            line-height: 1;
            font-weight: 800;
            transform: translateX(-1px);
          }

          .map-sidebar-handle.open {
            left: min(88vw, 370px);
            transform: translate(-100%, -50%);
            border-radius: 18px 0 0 18px;
          }

          .map-sidebar-backdrop {
            display: block;
          }

          .map-sidebar {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: min(88vw, 370px);
            min-width: min(88vw, 370px);
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 1700;
            border-right: none;
            box-shadow: 20px 0 44px rgba(15, 23, 42, 0.18);
          }

          .map-sidebar.open {
            transform: translateX(0);
          }

          .map-selected-preview {
            top: 16px;
            right: 14px;
            left: auto;
            max-width: min(300px, calc(100vw - 90px));
          }

          .map-floating-actions {
            right: 14px;
            bottom: 78px;
            left: auto;
          }

          .map-floating-button {
            min-height: 42px;
            padding: 10px 13px;
            border-radius: 16px;
          }

          .leaflet-top.leaflet-left {
            margin-top: 18px;
            margin-left: 48px;
          }
        }

        @media (max-width: 640px) {
          .map-sidebar-header {
            padding: 20px 16px 18px;
          }

          .map-sidebar-search-section {
            padding: 14px;
          }

          .map-hero-stat {
            padding: 10px 8px;
          }

          .map-hero-stat span {
            font-size: 16px;
          }

          .lake-modal-card {
            padding: 14px;
            border-radius: 20px;
          }

          .map-floating-actions {
            right: 12px;
            bottom: 78px;
          }

          .map-floating-button {
            font-size: 13px;
          }

          .map-sidebar-handle {
            width: 30px;
            height: 62px;
          }
        }

        @media (max-height: 820px) {
          .map-floating-actions {
            bottom: 84px;
          }

          .map-selected-preview {
            top: 14px;
          }
        }
      `}</style>
    </>
  );
}

export default FishingMap;
