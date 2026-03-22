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

  const visibleMarkerLakes = useMemo(() => {
    return markerLakes.filter((lake) => !activeLake || lake.id === activeLake.id);
  }, [markerLakes, activeLake]);

  const markerClusterKey = useMemo(() => {
    return visibleMarkerLakes
      .map((lake) => lake.id)
      .sort()
      .join("|");
  }, [visibleMarkerLakes]);

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

        {geometryLakes.map((lake) => (
          <GeoJSON
            key={`geometry-${lake.id}`}
            data={lake.simplifiedBoundary}
            style={() => ({
              color: activeLake?.id === lake.id ? "#0f172a" : "#2563eb",
              fillColor: activeLake?.id === lake.id ? "#38bdf8" : "#60a5fa",
              fillOpacity: activeLake?.id === lake.id ? 0.42 : 0.2,
              weight: activeLake?.id === lake.id ? 4 : 2,
            })}
            eventHandlers={{
              click: () => focusLake(lake),
            }}
          />
        ))}

        <MarkerClusterGroup
          key={markerClusterKey}
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          disableClusteringAtZoom={16}
          maxClusterRadius={40}
          iconCreateFunction={createClusterCustomIcon}
        >
          {visibleMarkerLakes.map((lake) => (
            <Marker
              key={`marker-${lake.id}`}
              position={[Number(lake.latitude), Number(lake.longitude)]}
              icon={createLakeIcon(activeLake?.id === lake.id)}
              zIndexOffset={activeLake?.id === lake.id ? 1000 : 0}
              eventHandlers={{
                click: () => focusLake(lake),
              }}
            />
          ))}
        </MarkerClusterGroup>

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