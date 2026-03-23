import React, { lazy, memo, Suspense, useMemo, useState } from "react";
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
import "react-leaflet-markercluster/styles";
import { FaLocationArrow, FaTimes } from "react-icons/fa";
import L from "leaflet";
import MapRecenter from "../components/MapRecenter";
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
} from "./fishingMapUtils";

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
}) {
  const [zoom, setZoom] = useState(BULGARIA_ZOOM);
  const overlayOpen = Boolean(activeLake);

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

  const geometryLakes = useMemo(() => {
    const lakesWithGeometry = filteredLakes.filter((lake) =>
      hasRenderableGeometry(lake.boundary),
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
  }, [filteredLakes, zoom, activeLakeId, activeLakeDedupeKey]);

  const markerLakes = useMemo(() => {
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
  }, [filteredLakes]);

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
  }, [markerLakes, activeLakeId, activeLakeDedupeKey]);

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
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
          maxZoom={19}
          eventHandlers={{
            loading: () => setTilesLoading(true),
            load: () => setTilesLoading(false),
          }}
        />

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
                color: isSelected ? "#0f172a" : "#2563eb",
                fillColor: isSelected ? "#38bdf8" : "#60a5fa",
                fillOpacity: isSelected ? 0.42 : 0.18,
                weight: isSelected ? 4 : 2,
              })}
              eventHandlers={{
                click: () => focusLake(lake),
              }}
            />
          );
        })}

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

        {topLevelMarkerLakes.map((lake) => (
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