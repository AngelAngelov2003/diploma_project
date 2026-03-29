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
  setSelectedRegion,
  showRegionOverview,
  setShowRegionOverview,
  locationModeActive,
  distanceKm,
  distanceFilterActive,
}) {
  const [zoom, setZoom] = useState(BULGARIA_ZOOM);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const overlayOpen = Boolean(activeLake);
  const regionsLayerRef = useRef(null);
  const hoveredRegionLayerRef = useRef(null);

  const activeLakeId =
    activeLake?.id === undefined || activeLake?.id === null
      ? null
      : String(activeLake.id);

  const activeLakeDedupeKey =
    activeLake?.dedupe_key === undefined || activeLake?.dedupe_key === null
      ? null
      : String(activeLake.dedupe_key);

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

  const getRegionName = useCallback((feature) => {
    return (
      feature?.properties?.shapeName ||
      feature?.properties?.name ||
      feature?.properties?.NAME_1 ||
      feature?.properties?.adm1_en ||
      feature?.properties?.ADM1_EN ||
      "Region"
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
    if (!mapInstance) return;

    const handleMapMouseOut = () => {
      clearHoveredRegion();
    };

    mapInstance.on("mouseout", handleMapMouseOut);

    return () => {
      mapInstance.off("mouseout", handleMapMouseOut);
    };
  }, [mapInstance, clearHoveredRegion]);

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

      layer.on({
        mouseover: () => {
          hoveredRegionLayerRef.current = layer;
          setHoveredRegion(regionName);

          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
          }
        },
        mouseout: () => {
          if (hoveredRegionLayerRef.current === layer) {
            clearHoveredRegion();
          }
        },
        click: (e) => {
          const bounds = e.target.getBounds();

          clearHoveredRegion();
          setSelectedRegion(regionName);
          setActiveLake(null);

          if (mapInstance) {
            mapInstance.fitBounds(bounds, {
              padding: [30, 30],
              maxZoom: 9,
            });
          }

          setTimeout(() => {
            setShowRegionOverview(false);
          }, 180);
        },
      });
    },
    [
      clearHoveredRegion,
      getRegionName,
      mapInstance,
      setActiveLake,
      setSelectedRegion,
      setShowRegionOverview,
    ]
  );

  return (
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
        <MemoZoomTracker onZoomChange={setZoom} />
        <MapRecenter activeLake={activeLake} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
          eventHandlers={{
            loading: () => setTilesLoading(true),
            load: () => setTilesLoading(false),
          }}
        />

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
            iconCreateFunction={createClusterCustomIcon}
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
          My location
        </button>

        <button onClick={handleLocateBulgaria} className="map-floating-button">
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

      {showRegionOverview && !locationModeActive && (
        <div className="map-overview-card">
          <div className="map-overview-card-label">
            {hoveredRegion ? "Hovered region" : "Overview"}
          </div>
          <div className="map-overview-card-title">
            {hoveredRegion || "Explore Bulgaria by region"}
          </div>
          <div className="map-overview-card-text">
            {hoveredRegion
              ? "Click to zoom into this region and load its lakes."
              : "Hover a region to preview it, then click to zoom in and view lakes in that area."}
          </div>
        </div>
      )}

      {selectedRegion && !activeLake && !showRegionOverview && (
        <div className="map-selected-preview">
          <div className="map-selected-preview-label">
            {locationModeActive ? "Nearby area" : "Region"}
          </div>
          <div className="map-selected-preview-title">{selectedRegion}</div>
          <div className="map-selected-preview-text">
            {locationModeActive
              ? "Showing lakes around your current location."
              : "Explore lakes inside this region."}
          </div>
        </div>
      )}

      {activeLake && (
        <div className="map-selected-preview">
          <div className="map-selected-preview-label">Selected location</div>
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
        <div className="map-loading-overlay">Loading map...</div>
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
                  Loading lake details...
                </div>
              }
            >
              <LakePopup lake={activeLake} map={mapInstance} />
            </Suspense>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(FishingMapCanvas);