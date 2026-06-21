import React, {
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Circle,
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { FaLocationArrow, FaTimes } from "react-icons/fa";
import L from "leaflet";
import MapRecenter from "./MapRecenter";
import bulgariaRegions from "../../data/geoBoundaries-BGR-ADM1.json";
import {
  BULGARIA_CENTER,
  BULGARIA_ZOOM,
  createClusterCustomIcon,
  createLakeIcon,
  createUserLocationIcon,
  dedupeLakesByNearbyMarkerPosition,
  formatDistance,
  getDisplayDescription,
  hasRenderableGeometry,
  truncate,
} from "../../features/fishing-map/fishingMap.utils";

const LakePopup = lazy(() => import("./LakePopUp"));

const REGION_NAME_BG = {
  Blagoevgrad: "Благоевград",
  Burgas: "Бургас",
  Dobrich: "Добрич",
  Gabrovo: "Габрово",
  Haskovo: "Хасково",
  Kardzhali: "Кърджали",
  Kyustendil: "Кюстендил",
  Lovech: "Ловеч",
  Montana: "Монтана",
  Pazardzhik: "Пазарджик",
  Pernik: "Перник",
  Pleven: "Плевен",
  Plovdiv: "Пловдив",
  Razgrad: "Разград",
  Ruse: "Русе",
  Shumen: "Шумен",
  Silistra: "Силистра",
  Sliven: "Сливен",
  Smolyan: "Смолян",
  Sofia: "София",
  "Sofia City": "София-град",
  "Sofia-Grad": "София-град",
  "Grad Sofiya": "София-град",
  "Stara Zagora": "Стара Загора",
  Targovishte: "Търговище",
  Varna: "Варна",
  "Veliko Tarnovo": "Велико Търново",
  Vidin: "Видин",
  Vratsa: "Враца",
  Yambol: "Ямбол",
};

const translateRegionName = (name) => REGION_NAME_BG[name] || name;

const MOBILE_BULGARIA_ZOOM = 6;
const getInitialBulgariaZoom = () =>
  typeof window !== "undefined" && window.innerWidth <= 640
    ? MOBILE_BULGARIA_ZOOM
    : BULGARIA_ZOOM;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function ZoomTracker({ onZoomChange }) {
  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });

  return null;
}

const MemoZoomTracker = memo(ZoomTracker);

function FishingMapCanvas({
  activeLake,
  focusLake,
  filteredLakes,
  mapUserLocation,
  selectedLakeDistance,
  handleZoomToMyLocation,
  handleLocateBulgaria,
  setActiveLake,
  setMapReady,
  setMapInstance,
  setTilesLoading,
  showMapLoadingOverlay,
  mapInstance,
  selectedRegion,
  selectedRegionFeature,
  setSelectedRegion,
  showRegionOverview,
  setShowRegionOverview,
  locationModeActive,
  distanceKm,
  distanceFilterActive,
  scheduleBoundsFetch,
}) {
  const [zoom, setZoom] = useState(() => getInitialBulgariaZoom());
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const overlayOpen = Boolean(activeLake);
  const regionsLayerRef = useRef(null);
  const hoveredRegionLayerRef = useRef(null);
  const overviewFitTimerRef = useRef(null);

  const selectedRegionFocusActive = Boolean(
    selectedRegionFeature &&
      selectedRegion &&
      !showRegionOverview &&
      !locationModeActive &&
      !distanceFilterActive,
  );

  const selectedRegionMask = useMemo(() => {
    if (!selectedRegionFocusActive || !selectedRegionFeature?.geometry) {
      return null;
    }

    const geometry = selectedRegionFeature.geometry;
    const worldRing = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90],
    ];

    const regionOuterRings =
      geometry.type === "Polygon"
        ? [geometry.coordinates?.[0]].filter(Boolean)
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
              .map((polygon) => polygon?.[0])
              .filter(Boolean)
          : [];

    if (!regionOuterRings.length) return null;

    return {
      type: "Feature",
      properties: { role: "selected-region-mask" },
      geometry: {
        type: "Polygon",
        coordinates: [worldRing, ...regionOuterRings],
      },
    };
  }, [selectedRegionFocusActive, selectedRegionFeature]);

  const activeLakeId =
    activeLake?.id === undefined || activeLake?.id === null
      ? null
      : String(activeLake.id);

  const activeLakeDedupeKey =
    activeLake?.dedupe_key === undefined || activeLake?.dedupe_key === null
      ? null
      : String(activeLake.dedupe_key);

  useEffect(() => {
    if (!overlayOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [overlayOpen]);

  const defaultLakeIcon = useMemo(() => createLakeIcon(false), []);
  const selectedLakeIcon = useMemo(() => createLakeIcon(true), []);
  const userLocationIcon = useMemo(() => createUserLocationIcon(), []);

  const numericDistanceKm = useMemo(() => {
    const value = Number(distanceKm);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [distanceKm]);

  const geometryLakes = useMemo(() => {
    if (showRegionOverview) return [];

    const lakesWithGeometry = filteredLakes.filter((lake) =>
      hasRenderableGeometry(lake)
    );

    if (zoom < 11) return [];

    if (zoom < 13) {
      if (!activeLakeId && !activeLakeDedupeKey) return [];

      return lakesWithGeometry.filter((lake) => {
        const sameId = activeLakeId && String(lake.id) === activeLakeId;
        const sameDedupeKey =
          activeLakeDedupeKey &&
          lake.dedupe_key !== undefined &&
          lake.dedupe_key !== null &&
          String(lake.dedupe_key) === activeLakeDedupeKey;

        return sameId || sameDedupeKey;
      });
    }

    return lakesWithGeometry;
  }, [
    filteredLakes,
    zoom,
    activeLakeId,
    activeLakeDedupeKey,
    showRegionOverview,
  ]);

  const markerLakes = useMemo(() => {
    if (showRegionOverview) return [];

    const lakesWithCoordinates = filteredLakes
      .map((lake) => {
        const latitude = Number(lake.latitude);
        const longitude = Number(lake.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          ...lake,
          latitude,
          longitude,
        };
      })
      .filter(Boolean);

    return dedupeLakesByNearbyMarkerPosition(lakesWithCoordinates, 90);
  }, [filteredLakes, showRegionOverview]);

  const clusterMarkerLakes = useMemo(() => {
    if (!activeLakeId && !activeLakeDedupeKey) return markerLakes;

    return markerLakes.filter((lake) => {
      const sameId = activeLakeId && String(lake.id) === activeLakeId;
      const sameDedupeKey =
        activeLakeDedupeKey &&
        lake.dedupe_key !== undefined &&
        lake.dedupe_key !== null &&
        String(lake.dedupe_key) === activeLakeDedupeKey;

      return !sameId && !sameDedupeKey;
    });
  }, [markerLakes, activeLakeId, activeLakeDedupeKey]);

  const topLevelMarkerLakes = useMemo(() => {
    if (showRegionOverview) return [];
    if (!activeLakeId && !activeLakeDedupeKey) return [];

    return markerLakes.filter((lake) => {
      const sameId = activeLakeId && String(lake.id) === activeLakeId;
      const sameDedupeKey =
        activeLakeDedupeKey &&
        lake.dedupe_key !== undefined &&
        lake.dedupe_key !== null &&
        String(lake.dedupe_key) === activeLakeDedupeKey;

      return sameId || sameDedupeKey;
    });
  }, [markerLakes, activeLakeId, activeLakeDedupeKey, showRegionOverview]);

  const markerClusterKey = useMemo(() => {
    return clusterMarkerLakes
      .map((lake) => `${lake.id}:${lake.latitude}:${lake.longitude}`)
      .sort()
      .join("|");
  }, [clusterMarkerLakes]);

  const selectedPreviewDescription = useMemo(() => {
    if (!activeLake) return "";
    return truncate(getDisplayDescription(activeLake.description), 110);
  }, [activeLake]);

  useEffect(() => {
    if (!mapInstance || !showRegionOverview || locationModeActive) return;

    const invalidateOverviewMap = () => {
      window.clearTimeout(overviewFitTimerRef.current);
      overviewFitTimerRef.current = window.setTimeout(() => {
        mapInstance.invalidateSize(false);
      }, 80);
    };

    invalidateOverviewMap();
    window.addEventListener("resize", invalidateOverviewMap);
    window.addEventListener("orientationchange", invalidateOverviewMap);

    return () => {
      window.clearTimeout(overviewFitTimerRef.current);
      window.removeEventListener("resize", invalidateOverviewMap);
      window.removeEventListener("orientationchange", invalidateOverviewMap);
    };
  }, [mapInstance, showRegionOverview, locationModeActive]);

  useEffect(() => {
    if (!mapInstance) return;

    const invalidateMapSize = () => {
      window.requestAnimationFrame(() => {
        mapInstance.invalidateSize(false);
      });
    };

    invalidateMapSize();
    window.addEventListener("resize", invalidateMapSize);
    window.addEventListener("orientationchange", invalidateMapSize);

    return () => {
      window.removeEventListener("resize", invalidateMapSize);
      window.removeEventListener("orientationchange", invalidateMapSize);
    };
  }, [mapInstance]);


  useEffect(() => {
    if (!mapInstance) return undefined;

    const previousMaxBounds = mapInstance.options.maxBounds || null;
    const previousMaxBoundsViscosity = mapInstance.options.maxBoundsViscosity || 0;

    if (selectedRegionFocusActive && selectedRegionFeature) {
      const regionBounds = L.geoJSON(selectedRegionFeature).getBounds();

      if (regionBounds?.isValid?.()) {
        mapInstance.setMaxBounds(regionBounds.pad(0.12));
        mapInstance.options.maxBoundsViscosity = 0.65;
      }
    } else {
      mapInstance.setMaxBounds(previousMaxBounds);
      mapInstance.options.maxBoundsViscosity = previousMaxBoundsViscosity;
    }

    return () => {
      mapInstance.setMaxBounds(previousMaxBounds);
      mapInstance.options.maxBoundsViscosity = previousMaxBoundsViscosity;
    };
  }, [mapInstance, selectedRegionFocusActive, selectedRegionFeature]);


  useEffect(() => {
    if (!mapInstance) return;

    const restoreRegionsWhenZoomedOut = () => {
      if (locationModeActive || distanceFilterActive) return;

      if (mapInstance.getZoom() <= getInitialBulgariaZoom() + 0.25) {
        setShowRegionOverview(true);
        setSelectedRegion(null);
        setActiveLake(null);
      }
    };

    mapInstance.on("zoomend", restoreRegionsWhenZoomedOut);

    return () => {
      mapInstance.off("zoomend", restoreRegionsWhenZoomedOut);
    };
  }, [
    mapInstance,
    locationModeActive,
    distanceFilterActive,
    setActiveLake,
    setSelectedRegion,
    setShowRegionOverview,
  ]);

  const handleClusterClick = useCallback(
    (event) => {
      const cluster = event?.layer;
      if (!cluster || !mapInstance) return;

      const currentZoom = mapInstance.getZoom();
      const clusterBounds = cluster.getBounds?.();

      if (clusterBounds?.isValid?.()) {
        mapInstance.fitBounds(clusterBounds, {
          padding: [72, 72],
          maxZoom: Math.max(currentZoom + 2, 15),
          animate: true,
        });
        return;
      }

      const clusterLatLng = cluster.getLatLng?.();
      if (clusterLatLng) {
        mapInstance.flyTo(clusterLatLng, Math.max(currentZoom + 2, 15), {
          duration: 0.9,
        });
      }
    },
    [mapInstance],
  );

  const getRegionName = useCallback((feature) => {
    return (
      feature?.properties?.shapeName ||
      feature?.properties?.name ||
      feature?.properties?.NAME_1 ||
      feature?.properties?.adm1_en ||
      feature?.properties?.ADM1_EN ||
      "Област"
    );
  }, []);

  const clearHoveredRegion = useCallback(() => {
    hoveredRegionLayerRef.current = null;
    setHoveredRegion(null);
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    const handleMapInteractionStart = () => {
      clearHoveredRegion();
    };

    mapInstance.on("zoomstart", handleMapInteractionStart);
    mapInstance.on("movestart", handleMapInteractionStart);

    return () => {
      mapInstance.off("zoomstart", handleMapInteractionStart);
      mapInstance.off("movestart", handleMapInteractionStart);
    };
  }, [mapInstance, clearHoveredRegion]);

  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      clearHoveredRegion();
    };

    window.addEventListener("blur", handleVisibilityOrBlur);
    document.addEventListener("visibilitychange", handleVisibilityOrBlur);

    return () => {
      window.removeEventListener("blur", handleVisibilityOrBlur);
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
    };
  }, [clearHoveredRegion]);

  useEffect(() => {
    if (!showRegionOverview) {
      clearHoveredRegion();
    }
  }, [showRegionOverview, clearHoveredRegion]);

  const getRegionStyle = useCallback(
    (feature) => {
      const regionName = getRegionName(feature);
      const isSelected = selectedRegion === regionName;
      const isHovered = hoveredRegion === regionName;

      return {
        color: isSelected || isHovered ? "#0f172a" : "#64748b",
        weight: isSelected || isHovered ? 3 : 1.2,
        fillColor: isSelected ? "#60a5fa" : "#93c5fd",
        fillOpacity: isSelected ? 0.2 : isHovered ? 0.24 : 0.08,
        opacity: isSelected || isHovered ? 1 : 0.72,
      };
    },
    [getRegionName, selectedRegion, hoveredRegion]
  );

  const handleEachRegion = useCallback(
    (feature, layer) => {
      const regionName = getRegionName(feature);

      layer.bindTooltip(regionName, {
        className: "region-tooltip",
        sticky: true,
        direction: "top",
        opacity: 0.96,
      });

      layer.on({
        mouseover: () => {
          hoveredRegionLayerRef.current = layer;
          setHoveredRegion(regionName);
          layer.setStyle(getRegionStyle(feature));

          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
          }
        },
        mousemove: () => {
          hoveredRegionLayerRef.current = layer;
          setHoveredRegion(regionName);
        },
        mouseout: () => {
          if (hoveredRegionLayerRef.current === layer) {
            clearHoveredRegion();
            layer.setStyle(getRegionStyle(feature));
          }
        },
        click: (e) => {
          const bounds = e.target.getBounds();
          const isSmallScreen =
            typeof window !== "undefined" ? window.innerWidth <= 640 : false;

          clearHoveredRegion();
          setSelectedRegion(regionName);
          setActiveLake(null);
          setShowRegionOverview(false);

          if (mapInstance) {
            const fetchAfterMove = () => {
              scheduleBoundsFetch?.({ immediate: true });
            };

            mapInstance.once("moveend", fetchAfterMove);
            mapInstance.fitBounds(bounds, {
              padding: isSmallScreen ? [10, 10] : [16, 16],
              maxZoom: isSmallScreen ? 10 : 10,
              animate: true,
            });

            window.setTimeout(fetchAfterMove, 350);
          }
        },
      });
    },
    [
      clearHoveredRegion,
      getRegionName,
      getRegionStyle,
      mapInstance,
      setActiveLake,
      setSelectedRegion,
      setShowRegionOverview,
      scheduleBoundsFetch,
    ]
  );

  return (
    <section className={`map-main-panel ${overlayOpen ? "lake-overlay-open" : ""}`}>
      <MapContainer
        center={BULGARIA_CENTER}
        zoom={getInitialBulgariaZoom()}
        minZoom={4}
        maxZoom={19}
        className="fishing-map-canvas"
        whenReady={(event) => {
          setMapInstance(event.target);
          setMapReady(true);
        }}
      >
        <MemoZoomTracker onZoomChange={setZoom} />
        <MapRecenter
          activeLake={activeLake}
          options={{
            maxZoom: 16,
            markerZoom: 15,
            paddingTopLeft: [56, 56],
            paddingBottomRight: [420, 96],
            centerOffset: [220, 0],
            duration: 1.1,
          }}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
          eventHandlers={{
            loading: () => setTilesLoading(true),
            load: () => setTilesLoading(false),
          }}
        />

        {selectedRegionMask && (
          <GeoJSON
            key={`region-mask-${selectedRegion}`}
            data={selectedRegionMask}
            interactive={false}
            style={() => ({
              color: "transparent",
              weight: 0,
              fillColor: "#0f172a",
              fillOpacity: 0.72,
              fillRule: "evenodd",
            })}
          />
        )}

        {selectedRegionFocusActive && selectedRegionFeature && (
          <GeoJSON
            key={`selected-region-outline-${selectedRegion}`}
            data={selectedRegionFeature}
            interactive={false}
            style={() => ({
              color: "#0f172a",
              weight: 3,
              fillColor: "#60a5fa",
              fillOpacity: 0.06,
              opacity: 1,
            })}
          />
        )}

        {showRegionOverview && !locationModeActive && (
          <GeoJSON
            ref={regionsLayerRef}
            data={bulgariaRegions}
            style={getRegionStyle}
            onEachFeature={handleEachRegion}
          />
        )}

        {geometryLakes.map((lake) => {
          const isSelected =
            (activeLakeId && String(lake.id) === activeLakeId) ||
            (activeLakeDedupeKey &&
              lake.dedupe_key !== undefined &&
              lake.dedupe_key !== null &&
              String(lake.dedupe_key) === activeLakeDedupeKey);

          return (
            <GeoJSON
              key={`geometry-${lake.id}`}
              data={lake.boundary}
              style={() => ({
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: isSelected ? 0.78 : 0.62,
                weight: isSelected ? 3.2 : 2.4,
                opacity: 1,
              })}
            />
          );
        })}

        {!showRegionOverview && clusterMarkerLakes.length > 0 && (
          <MarkerClusterGroup
            key={markerClusterKey}
            chunkedLoading
            showCoverageOnHover={false}
            spiderfyOnMaxZoom
            removeOutsideVisibleBounds
            animate
            animateAddingMarkers={false}
            disableClusteringAtZoom={16}
            maxClusterRadius={40}
            zoomToBoundsOnClick={false}
            iconCreateFunction={createClusterCustomIcon}
            eventHandlers={{
              clusterclick: handleClusterClick,
            }}
          >
            {clusterMarkerLakes.map((lake) => (
              <Marker
                key={`cluster-marker-${lake.id}`}
                position={[lake.latitude, lake.longitude]}
                icon={defaultLakeIcon}
                eventHandlers={{
                  click: () => focusLake(lake),
                }}
              />
            ))}
          </MarkerClusterGroup>
        )}

        {!showRegionOverview &&
          topLevelMarkerLakes.map((lake) => (
            <Marker
              key={`top-marker-${lake.id}`}
              position={[lake.latitude, lake.longitude]}
              icon={selectedLakeIcon}
              zIndexOffset={2000}
              eventHandlers={{
                click: () => focusLake(lake),
              }}
            />
          ))}

        {mapUserLocation && distanceFilterActive && numericDistanceKm && (
          <Circle
            center={[mapUserLocation.latitude, mapUserLocation.longitude]}
            radius={numericDistanceKm * 1000}
            pathOptions={{
              color: "#f97316",
              weight: 2,
              fillColor: "#fb923c",
              fillOpacity: 0.08,
              dashArray: "10 8",
            }}
          />
        )}

        {mapUserLocation && (
          <>
            <Circle
              center={[mapUserLocation.latitude, mapUserLocation.longitude]}
              radius={180}
              pathOptions={{
                color: "#f97316",
                weight: 2,
                fillColor: "#fb923c",
                fillOpacity: 0.18,
              }}
            />
            <Circle
              center={[mapUserLocation.latitude, mapUserLocation.longitude]}
              radius={60}
              pathOptions={{
                color: "#ea580c",
                weight: 2,
                fillColor: "#f97316",
                fillOpacity: 0.28,
              }}
            />
            <Marker
              position={[mapUserLocation.latitude, mapUserLocation.longitude]}
              icon={userLocationIcon}
              zIndexOffset={2000}
            />
          </>
        )}
      </MapContainer>

      <div className="map-floating-actions">
        <button
          onClick={handleZoomToMyLocation}
          className="map-floating-button"
        >
          <FaLocationArrow />
          Моето местоположение
        </button>

        <button onClick={handleLocateBulgaria} className="map-floating-button">
          <FaLocationArrow />
          България
        </button>

        {activeLake && (
          <button
            onClick={() => setActiveLake(null)}
            className="map-floating-button secondary"
          >
            <FaTimes />
            Изчисти избора
          </button>
        )}
      </div>

      {showRegionOverview && !locationModeActive && (
        <div className="map-overview-card">
          <div className="map-overview-card-label">
            {hoveredRegion ? "Избран регион" : "Обзор"}
          </div>
          <div className="map-overview-card-title">
            {translateRegionName(hoveredRegion) || "Разгледайте България по региони"}
          </div>
          <div className="map-overview-card-text">
            {hoveredRegion
              ? "Натиснете за приближаване и зареждане на водоемите в региона."
              : "Посочете регион за преглед, след това натиснете за приближаване и преглед на водоемите в него."}
          </div>
        </div>
      )}

      {selectedRegion && !activeLake && !showRegionOverview && (
        <div className="map-selected-preview">
          <div className="map-selected-preview-label">
            {locationModeActive ? "Близък район" : "Област"}
          </div>
          <div className="map-selected-preview-title">{translateRegionName(selectedRegion)}</div>
          <div className="map-selected-preview-text">
            {locationModeActive
              ? "Показват се водоеми около текущото ви местоположение."
              : "Заредени са само водоемите в избрания регион."}
          </div>
          {!locationModeActive && (
            <button
              type="button"
              className="map-selected-preview-action"
              onClick={handleLocateBulgaria}
            >
              Покажи всички региони
            </button>
          )}
        </div>
      )}

      {activeLake && (
        <div className="map-selected-preview">
          <div className="map-selected-preview-label">Избрана локация</div>
          <div className="map-selected-preview-title">{activeLake.name}</div>
          <div className="map-selected-preview-text">
            {selectedPreviewDescription}
          </div>
          {selectedLakeDistance !== null && (
            <div className="map-selected-preview-distance">
              {formatDistance(selectedLakeDistance)}
            </div>
          )}
        </div>
      )}

      {showMapLoadingOverlay && (
        <div className="map-loading-overlay">Зареждане на картата...</div>
      )}

      {overlayOpen && (
        <div
          onClick={() => setActiveLake(null)}
          className="lake-modal-backdrop"
        >
          <div onClick={(e) => e.stopPropagation()} className="lake-modal-card">
            <button
              onClick={() => setActiveLake(null)}
              className="lake-modal-close"
            >
              ×
            </button>

            <Suspense
              fallback={
                <div style={{ padding: 24, textAlign: "center" }}>
                  Зареждане на детайли за водоема...
                </div>
              }
            >
              <LakePopup key={`${activeLake.id}-${activeLake.description || ""}`} lake={activeLake} map={mapInstance} />
            </Suspense>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(FishingMapCanvas);