import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import L from "leaflet";
import bulgariaRegions from "../../data/geoBoundaries-BGR-ADM1.json";
import { notifyError, notifySuccess } from "../../ui/toast";
import FishingMapSidebar from "../../components/map/FishingMapSidebar";
import FishingMapCanvas from "../../components/map/FishingMapCanvas";
import "../FishingMap.css";
import {
  BULGARIA_CENTER,
  BULGARIA_ZOOM,
  DEFAULT_DISTANCE_KM,
  getDistanceKm,
  getGeoOptions,
  getLocationErrorMessage,
  getRegionNameFromFeature,
  findRegionFeatureByPoint,
  hasRenderableGeometry,
} from "./fishingMap.utils";
import {
  BOUNDS_FETCH_DEBOUNCE_MS,
  SEARCH_FETCH_DEBOUNCE_MS,
  ROUTE_OPEN_RELEASE_DELAY_MS,
} from "./fishingMap.constants";
import {
  fetchWaterBodiesInBounds,
  fetchSearchResults,
  fetchWaterBodyById,
} from "./fishingMap.service";

function FishingMap() {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showRegionOverview, setShowRegionOverview] = useState(true);
  const [openingLakeFromRoute, setOpeningLakeFromRoute] = useState(false);
  const [waterBodies, setWaterBodies] = useState([]);
  const [searchMatches, setSearchMatches] = useState([]);
  const [serverError, setServerError] = useState(null);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingSearchMatches, setLoadingSearchMatches] = useState(false);
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
  const [sliderDistanceKm, setSliderDistanceKm] = useState(DEFAULT_DISTANCE_KM);
  const [sortBy, setSortBy] = useState("default");
  const [mapUserLocation, setMapUserLocation] = useState(null);
  const [
    shouldActivateDistanceAfterLocation,
    setShouldActivateDistanceAfterLocation,
  ] = useState(false);
  const [isCompactSidebar, setIsCompactSidebar] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false,
  );
  const [showDistancePanel, setShowDistancePanel] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 640 : true,
  );

  const canUseDistanceSorting = Boolean(
    userLocation &&
      Number.isFinite(userLocation.latitude) &&
      Number.isFinite(userLocation.longitude),
  );

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
  const latestBoundsRequestIdRef = useRef(0);
  const latestSearchRequestIdRef = useRef(0);
  const boundsFetchTimerRef = useRef(null);
  const searchFetchTimerRef = useRef(null);
  const routeReleaseTimerRef = useRef(null);

  const distanceFilterActive = distanceKm !== "ALL";
  const locationModeActive = Boolean(
    mapUserLocation &&
      Number.isFinite(mapUserLocation.latitude) &&
      Number.isFinite(mapUserLocation.longitude),
  );

  useEffect(() => {
    routeLakeHandledRef.current = false;
  }, [normalizedLakeIdFromRoute]);

  useEffect(() => {
    return () => {
      if (boundsFetchTimerRef.current) {
        clearTimeout(boundsFetchTimerRef.current);
      }
      if (searchFetchTimerRef.current) {
        clearTimeout(searchFetchTimerRef.current);
      }
      if (routeReleaseTimerRef.current) {
        clearTimeout(routeReleaseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    const handleZoomState = () => {
      const currentZoom = mapInstance.getZoom();

      if (locationModeActive || distanceFilterActive) {
        return;
      }

      if (currentZoom <= 8) {
        setShowRegionOverview(true);
        setSelectedRegion(null);
        setActiveLake(null);
      }
    };

    mapInstance.on("zoomend", handleZoomState);

    return () => {
      mapInstance.off("zoomend", handleZoomState);
    };
  }, [mapInstance, locationModeActive, distanceFilterActive]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth <= 640;
      setIsCompactSidebar(compact);

      if (!compact) {
        setShowDistancePanel(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const releaseRouteOpeningState = useCallback(() => {
    if (routeReleaseTimerRef.current) {
      clearTimeout(routeReleaseTimerRef.current);
    }

    routeReleaseTimerRef.current = setTimeout(() => {
      setOpeningLakeFromRoute(false);
    }, ROUTE_OPEN_RELEASE_DELAY_MS);
  }, []);

  const focusLake = useCallback((lake) => {
    if (!lake) return;

    setActiveLake(lake);
    setIsMobileSidebarOpen(false);
    setShowRegionOverview(false);

    setWaterBodies((prev) => {
      const alreadyExists = prev.some((item) => String(item.id) === String(lake.id));
      return alreadyExists ? prev : [lake, ...prev];
    });

    const latitude = Number(lake.latitude);
    const longitude = Number(lake.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const matchedRegion = findRegionFeatureByPoint(bulgariaRegions, {
        latitude,
        longitude,
      });

      setSelectedRegion(
        matchedRegion ? getRegionNameFromFeature(matchedRegion) : null,
      );
    }
  }, []);

  const dedupeById = useCallback((items) => {
    const seen = new Set();

    return items.filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const loadWaterBodiesInBounds = useCallback(async () => {
    if (!mapInstance || openingLakeFromRoute) return;

    const requestId = ++latestBoundsRequestIdRef.current;
    const bounds = mapInstance.getBounds();
    const zoom = mapInstance.getZoom();

    setLoadingWaterBodies(true);
    setServerError(null);

    try {
      const data = await fetchWaterBodiesInBounds({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom,
        q: searchTerm.trim() || undefined,
        sortBy,
        userLat: userLocation?.latitude,
        userLng: userLocation?.longitude,
        distanceKm: distanceFilterActive ? distanceKm : undefined,
      });

      if (requestId !== latestBoundsRequestIdRef.current) return;
      setWaterBodies(data || []);
    } catch (err) {
      if (requestId !== latestBoundsRequestIdRef.current) return;

      setServerError("Failed to load water bodies in bounds");
      notifyError(err, "Failed to load water bodies in bounds");
    } finally {
      if (requestId === latestBoundsRequestIdRef.current) {
        setLoadingWaterBodies(false);
      }
    }
  }, [
    mapInstance,
    openingLakeFromRoute,
    searchTerm,
    sortBy,
    userLocation,
    distanceKm,
    distanceFilterActive,
  ]);

  const scheduleBoundsFetch = useCallback(
    ({ immediate = false } = {}) => {
      if (boundsFetchTimerRef.current) {
        clearTimeout(boundsFetchTimerRef.current);
      }

      if (immediate) {
        loadWaterBodiesInBounds();
        return;
      }

      boundsFetchTimerRef.current = setTimeout(() => {
        loadWaterBodiesInBounds();
      }, BOUNDS_FETCH_DEBOUNCE_MS);
    },
    [loadWaterBodiesInBounds],
  );

  const searchWaterBodiesGlobally = useCallback(async (query) => {
    const trimmed = String(query || "").trim();

    if (!trimmed) {
      setSearchMatches([]);
      return;
    }

    const requestId = ++latestSearchRequestIdRef.current;

    setLoadingSearchMatches(true);
    setServerError(null);

    try {
      const data = await fetchSearchResults(trimmed);

      if (requestId !== latestSearchRequestIdRef.current) return;
      setSearchMatches(data || []);
    } catch (err) {
      if (requestId !== latestSearchRequestIdRef.current) return;

      setServerError("Search failed");
      notifyError(err, "Search failed");
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setLoadingSearchMatches(false);
      }
    }
  }, []);

  const getCurrentUserLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => reject(error),
        getGeoOptions(),
      );
    });
  }, []);

  const focusMapOnUserArea = useCallback(
    (nextLocation, radiusKm = null) => {
      if (!mapInstance) {
        return false;
      }

      const matchedRegion = findRegionFeatureByPoint(
        bulgariaRegions,
        nextLocation,
      );

      if (matchedRegion) {
        setSelectedRegion(getRegionNameFromFeature(matchedRegion));
      } else {
        setSelectedRegion(null);
      }

      setShowRegionOverview(false);

      const latitude = Number(nextLocation?.latitude);
      const longitude = Number(nextLocation?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false;
      }

      const center = L.latLng(latitude, longitude);
      const numericRadiusKm = Number(radiusKm);

      if (Number.isFinite(numericRadiusKm) && numericRadiusKm > 0) {
        const radiusMeters = numericRadiusKm * 1000;
        const radiusBounds = center.toBounds(radiusMeters * 2);

        mapInstance.fitBounds(radiusBounds.pad(0.12), {
          padding: [40, 40],
          maxZoom: 11,
        });
        return true;
      }

      mapInstance.flyTo(center, 10, { duration: 1.2 });
      return true;
    },
    [mapInstance],
  );

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;

    scheduleBoundsFetch({ immediate: true });

    const handleMoveLikeEvent = () => {
      if (!openingLakeFromRoute) {
        scheduleBoundsFetch();
      }
    };

    mapInstance.on("moveend", handleMoveLikeEvent);
    mapInstance.on("zoomend", handleMoveLikeEvent);

    return () => {
      mapInstance.off("moveend", handleMoveLikeEvent);
      mapInstance.off("zoomend", handleMoveLikeEvent);
    };
  }, [mapInstance, openingLakeFromRoute, scheduleBoundsFetch]);

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;
    scheduleBoundsFetch({ immediate: true });
  }, [
    mapInstance,
    openingLakeFromRoute,
    searchTerm,
    sortBy,
    userLocation,
    distanceKm,
    scheduleBoundsFetch,
  ]);

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;

    const trimmed = searchTerm.trim();

    if (searchFetchTimerRef.current) {
      clearTimeout(searchFetchTimerRef.current);
    }

    if (trimmed.length < 3) {
      setSearchMatches([]);
      setLoadingSearchMatches(false);
      return;
    }

    searchFetchTimerRef.current = setTimeout(() => {
      searchWaterBodiesGlobally(trimmed);
    }, SEARCH_FETCH_DEBOUNCE_MS);

    return () => {
      if (searchFetchTimerRef.current) {
        clearTimeout(searchFetchTimerRef.current);
      }
    };
  }, [
    searchTerm,
    mapInstance,
    searchWaterBodiesGlobally,
    openingLakeFromRoute,
  ]);

  useEffect(() => {
    const handleRouteLakeOpen = async () => {
      if (!normalizedLakeIdFromRoute || routeLakeHandledRef.current) return;

      setOpeningLakeFromRoute(true);

      const existing = [...waterBodies, ...searchMatches].find(
        (w) => String(w.id) === normalizedLakeIdFromRoute,
      );

      if (existing) {
        routeLakeHandledRef.current = true;
        setSearchTerm("");
        focusLake(existing);
        navigate(location.pathname, { replace: true, state: {} });
        releaseRouteOpeningState();
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
        releaseRouteOpeningState();
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
    searchMatches,
    focusLake,
    navigate,
    location.pathname,
    releaseRouteOpeningState,
  ]);

  useEffect(() => {
    let timer;
    const isLoading =
      !mapReady || tilesLoading || loadingWaterBodies || loadingSearchMatches;

    if (isLoading) {
      timer = setTimeout(() => setShowMapLoadingOverlay(true), 200);
    } else {
      setShowMapLoadingOverlay(false);
    }

    return () => clearTimeout(timer);
  }, [mapReady, tilesLoading, loadingWaterBodies, loadingSearchMatches]);

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

  useEffect(() => {
    if (!canUseDistanceSorting && sortBy === "nearest") {
      setSortBy("default");
    }
  }, [canUseDistanceSorting, sortBy]);

  const visibleLakes = waterBodies;

  const globalSearchLakes = useMemo(() => {
    const visibleIds = new Set(visibleLakes.map((lake) => String(lake.id)));
    return searchMatches.filter((lake) => !visibleIds.has(String(lake.id)));
  }, [searchMatches, visibleLakes]);

  const displayedLakes = useMemo(() => {
    if (!searchTerm.trim()) {
      return visibleLakes;
    }

    return dedupeById([...globalSearchLakes, ...visibleLakes]);
  }, [searchTerm, globalSearchLakes, visibleLakes, dedupeById]);

  const geometryCount = useMemo(
    () => visibleLakes.filter((lake) => hasRenderableGeometry(lake)).length,
    [visibleLakes],
  );

  const markerCount = useMemo(
    () =>
      visibleLakes.filter(
        (lake) =>
          Number.isFinite(Number(lake?.latitude)) &&
          Number.isFinite(Number(lake?.longitude)),
      ).length,
    [visibleLakes],
  );

  const visibleMarkerCount = markerCount;

  const handleLocateBulgaria = useCallback(() => {
    if (!mapInstance) return;

    setSearchTerm("");
    setSearchMatches([]);
    setActiveLake(null);
    setSelectedRegion(null);

    if (!locationModeActive && !distanceFilterActive) {
      setShowRegionOverview(true);
    } else {
      setShowRegionOverview(false);
    }

    mapInstance.flyTo(BULGARIA_CENTER, BULGARIA_ZOOM, { duration: 1.2 });
  }, [mapInstance, locationModeActive, distanceFilterActive]);

  const handleUseMyLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationError("");

      const nextLocation = await getCurrentUserLocation();
      const radiusToUse = shouldActivateDistanceAfterLocation
        ? Number(sliderDistanceKm || DEFAULT_DISTANCE_KM)
        : null;

      setUserLocation(nextLocation);
      setMapUserLocation(nextLocation);
      setSearchTerm("");
      setSearchMatches([]);
      setActiveLake(null);

      focusMapOnUserArea(nextLocation, radiusToUse);

      if (shouldActivateDistanceAfterLocation) {
        setDistanceKm(String(sliderDistanceKm || DEFAULT_DISTANCE_KM));
        setShouldActivateDistanceAfterLocation(false);
        notifySuccess("Location detected and distance filter activated");
      } else {
        notifySuccess("Location detected. Nearby lakes are now shown.");
      }
    } catch (error) {
      const message =
        error?.message === "Geolocation is not supported in this browser"
          ? error.message
          : getLocationErrorMessage(error);

      setLocationError(message);
      setShouldActivateDistanceAfterLocation(false);
      notifyError(null, message);
    } finally {
      setLocationLoading(false);
    }
  }, [
    getCurrentUserLocation,
    shouldActivateDistanceAfterLocation,
    sliderDistanceKm,
    focusMapOnUserArea,
  ]);

  const handleZoomToMyLocation = useCallback(async () => {
    try {
      const nextLocation = await getCurrentUserLocation();
      const radiusToUse = distanceFilterActive ? Number(distanceKm) : null;

      setMapUserLocation(nextLocation);
      setUserLocation(nextLocation);
      setSearchTerm("");
      setSearchMatches([]);
      setActiveLake(null);

      focusMapOnUserArea(nextLocation, radiusToUse);
    } catch (error) {
      const message =
        error?.message === "Geolocation is not supported in this browser"
          ? error.message
          : getLocationErrorMessage(error);

      notifyError(null, message);
    }
  }, [
    focusMapOnUserArea,
    getCurrentUserLocation,
    distanceFilterActive,
    distanceKm,
  ]);

  const handleDistanceSliderChange = useCallback(
    (e) => {
      const nextValue = Number(e.target.value);
      setSliderDistanceKm(nextValue);

      if (distanceFilterActive && userLocation) {
        setDistanceKm(String(nextValue));
      }
    },
    [distanceFilterActive, userLocation],
  );

  const handleEnableDistanceFilter = useCallback(() => {
    if (!userLocation) {
      setShouldActivateDistanceAfterLocation(true);
      handleUseMyLocation();
      return;
    }

    setMapUserLocation(userLocation);
    setDistanceKm(String(sliderDistanceKm));
    setShowRegionOverview(false);
    setActiveLake(null);
    focusMapOnUserArea(userLocation, Number(sliderDistanceKm));
  }, [userLocation, handleUseMyLocation, sliderDistanceKm, focusMapOnUserArea]);

  const clearDistanceFilter = useCallback(() => {
    setUserLocation(null);
    setMapUserLocation(null);
    setLocationError("");
    setDistanceKm("ALL");
    setShouldActivateDistanceAfterLocation(false);
    setSelectedRegion(null);
    setShowRegionOverview(true);
    setActiveLake(null);

    if (sortBy === "nearest") {
      setSortBy("default");
    }

    if (mapInstance) {
      mapInstance.flyTo(BULGARIA_CENTER, BULGARIA_ZOOM, { duration: 1.2 });
    }
  }, [sortBy, mapInstance]);

  const selectedLakeDistance = useMemo(() => {
    if (!activeLake || !userLocation) return null;

    const lat = Number(activeLake.latitude);
    const lng = Number(activeLake.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return getDistanceKm(userLocation, { lat, lng });
  }, [activeLake, userLocation]);

  return (
    <div className="fishing-map-page">
      <FishingMapSidebar
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        waterBodies={displayedLakes}
        markerCount={markerCount}
        geometryCount={geometryCount}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        loadingWaterBodies={loadingWaterBodies || loadingSearchMatches}
        handleUseMyLocation={handleUseMyLocation}
        locationLoading={locationLoading}
        sortBy={sortBy}
        setSortBy={setSortBy}
        canUseDistanceSorting={canUseDistanceSorting}
        clearDistanceFilter={clearDistanceFilter}
        userLocation={userLocation}
        mapUserLocation={mapUserLocation}
        locationError={locationError}
        distanceKm={distanceKm}
        isCompactSidebar={isCompactSidebar}
        showDistancePanel={showDistancePanel}
        setShowDistancePanel={setShowDistancePanel}
        distanceFilterActive={distanceFilterActive}
        sliderDistanceKm={sliderDistanceKm}
        handleDistanceSliderChange={handleDistanceSliderChange}
        handleEnableDistanceFilter={handleEnableDistanceFilter}
        filteredLakes={displayedLakes}
        visibleMarkerCount={visibleMarkerCount}
        serverError={serverError}
        activeLake={activeLake}
        focusLake={focusLake}
        setDistanceKm={setDistanceKm}
        searchMatchesCount={globalSearchLakes.length}
      />

      <FishingMapCanvas
        activeLake={activeLake}
        focusLake={focusLake}
        filteredLakes={displayedLakes}
        mapUserLocation={mapUserLocation}
        selectedLakeDistance={selectedLakeDistance}
        handleZoomToMyLocation={handleZoomToMyLocation}
        handleLocateBulgaria={handleLocateBulgaria}
        setActiveLake={setActiveLake}
        setMapReady={setMapReady}
        setMapInstance={setMapInstance}
        setTilesLoading={setTilesLoading}
        showMapLoadingOverlay={showMapLoadingOverlay}
        mapInstance={mapInstance}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        showRegionOverview={showRegionOverview}
        setShowRegionOverview={setShowRegionOverview}
        locationModeActive={locationModeActive}
        distanceKm={distanceKm}
        distanceFilterActive={distanceFilterActive}
      />
    </div>
  );
}

export default FishingMap;