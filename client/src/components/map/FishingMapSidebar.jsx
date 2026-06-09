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
  hasRenderableGeometry,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  shouldShowMarker,
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
            ? "Затвори панела с локации"
            : "Отвори панела с локации"
        }
      >
        <span>{isMobileSidebarOpen ? "‹" : "›"}</span>
      </button>

      {isMobileSidebarOpen && (
        <button
          className="map-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Затвори панела с локации"
        />
      )}

      <aside className={`map-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
        <div className="map-sidebar-header compact">
          <div className="map-sidebar-brand">
            <div className="map-sidebar-brand-icon">
              <FaFish />
            </div>
            <div>
              <h2>Риболовен атлас</h2>
              <p>Намерете водоеми и риболовни места</p>
            </div>
          </div>

          <div className="map-sidebar-hero-stats">
            <div className="map-hero-stat">
              <span>{filteredLakes.length}</span>
              <small>Водоеми</small>
            </div>
            <div className="map-hero-stat">
              <span>{visibleMarkerCount}</span>
              <small>На картата</small>
            </div>
            <div className="map-hero-stat">
              <span>{searchIsActive ? "Филтрирани" : "Всички"}</span>
              <small>Статус</small>
            </div>
          </div>
        </div>

        <div className="map-sidebar-section">
          <div className="map-search-box">
            <FaSearch className="map-search-icon" />
            <input
              type="text"
              placeholder="Търсене на водоеми..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {loadingWaterBodies && searchTerm.trim() && (
              <span className="map-search-loading">Зареждане...</span>
            )}
            {searchTerm && !loadingWaterBodies && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="map-search-clear"
              >
                <FaTimes />
              </button>
            )}
          </div>

          {searchTerm && (
            <div className="map-search-results-info">
              Показани резултати: {filteredLakes.length}
            </div>
          )}

          {searchIsActive && searchMatchesCount > 0 && (
            <div className="map-search-mode-note">
              Още {searchMatchesCount} резултата са намерени извън тази област.
            </div>
          )}
        </div>

        <div className="map-sidebar-section">
          <div className="map-controls-grid">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locationLoading}
              className="map-control-button primary"
            >
              <FaLocationArrow />
              <span>
                {locationLoading ? "Вземане на местоположение..." : "Използвай местоположение"}
              </span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="map-control-select"
              disabled={searchIsActive}
            >
              <option value="default">Подреждане по подразбиране</option>
              <option value="nearest" disabled={!canUseDistanceSorting}>
                Най-близките първо
              </option>
              <option value="name">A–Z</option>
            </select>

            <button
              type="button"
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
              <span>Изчисти филтъра за местоположение</span>
            </button>
          </div>

          {!canUseDistanceSorting && (
            <div className="map-sort-helper">
              Разрешете местоположение, за да сортирате по разстояние.
            </div>
          )}

          {isCompactSidebar && (
            <button
              type="button"
              className="map-distance-toggle"
              onClick={() => setShowDistancePanel((v) => !v)}
            >
              <span>Инструменти за разстояние</span>
              <span>
                {distanceFilterActive
                  ? `До ${sliderDistanceKm} км`
                  : showDistancePanel
                    ? "Скрий"
                    : "Покажи"}
              </span>
            </button>
          )}

          {showDistancePanel && (
            <div className="map-distance-slider-card">
              <div className="map-distance-slider-header">
                <div className="map-distance-slider-title">Филтър по разстояние</div>
                <div className="map-distance-slider-value">
                  {distanceFilterActive
                    ? `До ${sliderDistanceKm} км`
                    : "Всички разстояния"}
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
                    ? "Приложи разстоянието"
                    : "Използвай местоположение"}
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
                    ? ` • показани са локации в радиус от ${distanceKm} км`
                    : " • сортирането по близост е налично"}
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
            <div className="map-empty-state">Зареждане на локации...</div>
          ) : filteredLakes.length === 0 ? (
            <div className="map-empty-state">
              {searchTerm.trim()
                ? "Няма намерени локации за това търсене."
                : waterBodies.length === 0
                  ? "Няма видими водоеми в тази зона."
                  : "Няма локации, които да съвпадат с филтрите."}
            </div>
          ) : (
            filteredLakes.map((lake) => {
              const selected = activeLake?.id === lake.id;
              const distanceLabel = formatDistance(lake.distanceKm);

              return (
                <button
                  type="button"
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
                    </div>

                    {selected && (
                      <div className="lake-list-card-badge">Избран</div>
                    )}
                  </div>

                  <div className="lake-list-card-meta">
                    <span className="lake-meta-chip">
                      <FaSlidersH />
                      Профил на водоема
                    </span>

                    {lake.type && (
                      <span className="lake-meta-chip">
                        {formatWaterBodyType(lake.type)}
                      </span>
                    )}

                    {shouldShowMarker(lake) && (
                      <span className="lake-meta-chip">Координатите са готови</span>
                    )}

                    {hasRenderableGeometry(lake) && (
                      <span className="lake-meta-chip">Геометрията е налична</span>
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
