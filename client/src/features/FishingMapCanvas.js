import React, { useMemo, useState } from "react";
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
import LakePopup from "./LakePopUp";
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
  shouldRenderGeometryByZoom,
  simplifyGeometry,
  truncate,
} from "./fishingMapUtils";

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

  const geometryLakes = useMemo(() => {
    if (!shouldRenderGeometryByZoom(zoom)) return [];

    return filteredLakes
      .filter((lake) => hasRenderableGeometry(lake.boundary))
      .map((lake) => ({
        ...lake,
        simplifiedBoundary: simplifyGeometry(lake.boundary, zoom),
      }));
  }, [filteredLakes, zoom]);

  const markerLakes = useMemo(() => {
    const lakesWithCoordinates = filteredLakes.filter(
      (lake) =>
        Number.isFinite(Number(lake.latitude)) &&
        Number.isFinite(Number(lake.longitude)),
    );

    return dedupeLakesByNearbyMarkerPosition(lakesWithCoordinates, 90);
  }, [filteredLakes]);

  const selectedLakeIds = useMemo(() => {
    const ids = new Set();
    if (activeLake?.id !== undefined && activeLake?.id !== null) {
      ids.add(String(activeLake.id));
    }
    return ids;
  }, [activeLake]);

  const clusterMarkerLakes = useMemo(() => {
    return markerLakes.filter((lake) => !selectedLakeIds.has(String(lake.id)));
  }, [markerLakes, selectedLakeIds]);

  const topLevelMarkerLakes = useMemo(() => {
    return markerLakes.filter((lake) => selectedLakeIds.has(String(lake.id)));
  }, [markerLakes, selectedLakeIds]);

  const markerClusterKey = useMemo(() => {
    return clusterMarkerLakes
      .map((lake) => lake.id)
      .sort()
      .join("|");
  }, [clusterMarkerLakes]);

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
        <ZoomTracker onZoomChange={setZoom} />
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
          const isSelected = activeLake?.id === lake.id;

          return (
            <GeoJSON
              key={`geometry-${lake.id}`}
              data={lake.simplifiedBoundary}
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
              position={[Number(lake.latitude), Number(lake.longitude)]}
              icon={createLakeIcon(false)}
              eventHandlers={{
                click: () => focusLake(lake),
              }}
            />
          ))}
        </MarkerClusterGroup>

        {topLevelMarkerLakes.map((lake) => {
          const isSelected = activeLake?.id === lake.id;

          return (
            <Marker
              key={`top-marker-${lake.id}`}
              position={[Number(lake.latitude), Number(lake.longitude)]}
              icon={createLakeIcon(isSelected)}
              zIndexOffset={isSelected ? 2000 : 1500}
              eventHandlers={{
                click: () => focusLake(lake),
              }}
            />
          );
        })}

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
              icon={createUserLocationIcon()}
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
            onClick={() => {
              setActiveLake(null);
            }}
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
          <div onClick={(e) => e.stopPropagation()} className="lake-modal-card">
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
  );
}

export default FishingMapCanvas;