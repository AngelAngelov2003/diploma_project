import React from "react";
import {
  FaFish,
  FaSearch,
  FaTimes,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaSlidersH,
  FaLocationArrow,
} from "react-icons/fa";
import {
  formatDistance,
  formatWaterBodyType,
  getDisplayDescription,
  hasRenderableGeometry,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  shouldShowMarker,
  truncate,
} from "../../features/fishing-map/fishingMap.utils";

function FishingMapSidebar({
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  waterBodies,
  markerCount,
  geometryCount,
  searchTerm,
  setSearchTerm,
  loadingWaterBodies,
  handleUseMyLocation,
  locationLoading,
  sortBy,
  setSortBy,
  canUseDistanceSorting,
  clearDistanceFilter,
  userLocation,
  mapUserLocation,
  locationError,
  distanceKm,
  isCompactSidebar,
  showDistancePanel,
  setShowDistancePanel,
  distanceFilterActive,
  sliderDistanceKm,
  handleDistanceSliderChange,
  handleEnableDistanceFilter,
  filteredLakes,
  visibleMarkerCount,
  serverError,
  activeLake,
  focusLake,
  setDistanceKm,
  searchMatchesCount = 0,
}) {
  const searchIsActive = Boolean(searchTerm.trim());

  const highlightText = (text, query) => {
    const safeText = text || "";
    const safeQuery = query?.trim();

    if (!safeQuery) {
      return safeText;
    }

    const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = safeText.split(new RegExp(`(${escaped})`, "gi"));

    return parts.map((part, index) =>
      part.toLowerCase() === safeQuery.toLowerCase() ? (
        <mark key={`${part}-${index}`}>{part}</mark>
      ) : (
        part
      ),
    );
  };

  return (
    <>
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
        <div className="map-sidebar-header compact">
          <div className="map-sidebar-brand">
            <div className="map-sidebar-brand-icon">
              <FaFish />
            </div>
            <div>
              <h2>Fishing Atlas</h2>
              <p>Find lakes and fishing spots</p>
            </div>
          </div>

          <div className="map-sidebar-hero-stats">
            <div className="map-hero-stat">
              <span>{filteredLakes.length}</span>
              <small>Lakes</small>
            </div>
            <div className="map-hero-stat">
              <span>{visibleMarkerCount}</span>
              <small>On map</small>
            </div>
            <div className="map-hero-stat">
              <span>{searchIsActive ? "Filtered" : "All"}</span>
              <small>Status</small>
            </div>
          </div>
        </div>

        <div className="map-sidebar-section">
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

          {searchTerm && (
            <div className="map-search-results-info">
              Showing {filteredLakes.length} result
              {filteredLakes.length === 1 ? "" : "s"}
            </div>
          )}

          {searchIsActive && searchMatchesCount > 0 && (
            <div className="map-search-mode-note">
              {searchMatchesCount} more result
              {searchMatchesCount === 1 ? "" : "s"} found outside this area.
            </div>
          )}
        </div>

        <div className="map-sidebar-section">
          <div className="map-controls-grid">
            <button
              onClick={handleUseMyLocation}
              disabled={locationLoading}
              className="map-control-button primary"
            >
              <FaLocationArrow />
              <span>
                {locationLoading ? "Getting location..." : "Enable location"}
              </span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="map-control-select"
              disabled={searchIsActive}
            >
              <option value="default">Default order</option>
              <option value="nearest" disabled={!canUseDistanceSorting}>
                Nearest first
              </option>
              <option value="name">A–Z</option>
            </select>

            <button
              onClick={clearDistanceFilter}
              className="map-control-button secondary"
              disabled={
                !userLocation &&
                !mapUserLocation &&
                !locationError &&
                distanceKm === "ALL"
              }
            >
              <FaTimes />
              <span>Clear location filter</span>
            </button>
          </div>

          {!canUseDistanceSorting && (
            <div className="map-sort-helper">
              Enable your location to sort by distance.
            </div>
          )}

          {isCompactSidebar && (
            <button
              type="button"
              className="map-distance-toggle"
              onClick={() => setShowDistancePanel((v) => !v)}
            >
              <span>Distance tools</span>
              <span>
                {distanceFilterActive
                  ? `Within ${sliderDistanceKm} km`
                  : showDistancePanel
                    ? "Hide"
                    : "Show"}
              </span>
            </button>
          )}

          {showDistancePanel && (
            <div className="map-distance-slider-card">
              <div className="map-distance-slider-header">
                <div className="map-distance-slider-title">Distance filter</div>
                <div className="map-distance-slider-value">
                  {distanceFilterActive
                    ? `Within ${sliderDistanceKm} km`
                    : "All distances"}
                </div>
              </div>

              <input
                type="range"
                min={MIN_DISTANCE_KM}
                max={MAX_DISTANCE_KM}
                step="5"
                value={sliderDistanceKm}
                onChange={handleDistanceSliderChange}
                className="map-distance-slider"
                disabled={!userLocation && !distanceFilterActive}
              />

              <div className="map-distance-slider-scale">
                <span>{MIN_DISTANCE_KM} km</span>
                <span>{MAX_DISTANCE_KM} km</span>
              </div>

              <div className="map-distance-slider-actions">
                <button
                  type="button"
                  className={`map-chip-button ${
                    distanceFilterActive ? "active" : ""
                  }`}
                  onClick={handleEnableDistanceFilter}
                  disabled={locationLoading}
                >
                  {userLocation
                    ? "Apply slider distance"
                    : "Use location + apply"}
                </button>

                <button
                  type="button"
                  className={`map-chip-button ${
                    !distanceFilterActive ? "active secondary" : "secondary"
                  }`}
                  onClick={() => setDistanceKm("ALL")}
                >
                  All distances
                </button>
              </div>
            </div>
          )}

          {(userLocation || locationError) && (
            <div
              className={`map-location-status ${
                locationError ? "error" : "success"
              }`}
            >
              {locationError ? (
                <span>{locationError}</span>
              ) : (
                <span>
                  Location active
                  {distanceFilterActive
                    ? ` • showing locations within ${distanceKm} km`
                    : " • nearest sorting is available"}
                </span>
              )}
            </div>
          )}
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
          ) : filteredLakes.length === 0 ? (
            <div className="map-empty-state">
              {searchTerm.trim()
                ? "No locations found anywhere for this search."
                : waterBodies.length === 0
                  ? "No water bodies visible in this area."
                  : "No locations match your filters."}
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
                        {truncate(getDisplayDescription(lake.description), 88)}
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
                      <span className="lake-meta-chip">Coordinates ready</span>
                    )}

                    {hasRenderableGeometry(lake) && (
                      <span className="lake-meta-chip">Geometry available</span>
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
    </>
  );
}

export default FishingMapSidebar;
