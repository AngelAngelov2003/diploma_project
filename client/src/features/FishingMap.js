import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import L from "leaflet";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";
import FishingMapSidebar from "./FishingMapSidebar";
import FishingMapCanvas from "./FishingMapCanvas";
import "./FishingMap.css";
import {
  BULGARIA_CENTER,
  BULGARIA_ZOOM,
  DEFAULT_DISTANCE_KM,
  getDistanceKm,
  getGeoOptions,
  getLocationErrorMessage,
  hasRenderableGeometry,
} from "./fishingMapUtils";

const BOUNDS_FETCH_DEBOUNCE_MS = 250;
const SEARCH_FETCH_DEBOUNCE_MS = 600;
const ROUTE_OPEN_RELEASE_DELAY_MS = 1200;

function FishingMap() {
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
  const boundsAbortControllerRef = useRef(null);
  const searchAbortControllerRef = useRef(null);

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
      if (boundsAbortControllerRef.current) {
        boundsAbortControllerRef.current.abort();
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

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

  const focusLake = useCallback(
    (lake) => {
      if (!lake) return;

      setActiveLake(lake);
      setIsMobileSidebarOpen(false);

      const latitude = Number(lake.latitude);
      const longitude = Number(lake.longitude);

      if (
        mapInstance &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        mapInstance.flyTo(
          [latitude, longitude],
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

  const dedupeById = useCallback((items) => {
    const seen = new Set();

    return items.filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const fetchWaterBodiesInBounds = useCallback(
    async ({ silent = false } = {}) => {
      if (!mapInstance || openingLakeFromRoute) return;

      const requestId = ++latestBoundsRequestIdRef.current;
      const bounds = mapInstance.getBounds();
      const zoom = mapInstance.getZoom();

      if (boundsAbortControllerRef.current) {
        boundsAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      boundsAbortControllerRef.current = abortController;

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
            q: searchTerm.trim() || undefined,
            sortBy,
            userLat: userLocation?.latitude,
            userLng: userLocation?.longitude,
            distanceKm: distanceKm !== "ALL" ? distanceKm : undefined,
          },
          signal: abortController.signal,
        });

        if (requestId !== latestBoundsRequestIdRef.current) return;
        setWaterBodies(res.data || []);
      } catch (err) {
        if (abortController.signal.aborted) return;
        if (requestId !== latestBoundsRequestIdRef.current) return;

        setServerError("Failed to load water bodies in bounds");
        if (!silent) {
          notifyError(err, "Failed to load water bodies in bounds");
        }
      } finally {
        if (
          requestId === latestBoundsRequestIdRef.current &&
          !abortController.signal.aborted
        ) {
          setLoadingWaterBodies(false);
        }
      }
    },
    [
      mapInstance,
      openingLakeFromRoute,
      searchTerm,
      sortBy,
      userLocation,
      distanceKm,
    ],
  );

  const scheduleBoundsFetch = useCallback(
    ({ silent = true, immediate = false } = {}) => {
      if (boundsFetchTimerRef.current) {
        clearTimeout(boundsFetchTimerRef.current);
      }

      if (immediate) {
        fetchWaterBodiesInBounds({ silent });
        return;
      }

      boundsFetchTimerRef.current = setTimeout(() => {
        fetchWaterBodiesInBounds({ silent });
      }, BOUNDS_FETCH_DEBOUNCE_MS);
    },
    [fetchWaterBodiesInBounds],
  );

  const searchWaterBodiesGlobally = useCallback(async (query) => {
    const trimmed = String(query || "").trim();

    if (!trimmed) {
      setSearchMatches([]);
      return;
    }

    const requestId = ++latestSearchRequestIdRef.current;

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    setLoadingSearchMatches(true);
    setServerError(null);

    try {
      const res = await api.get("/water-bodies/search", {
        params: { q: trimmed },
        signal: abortController.signal,
      });

      if (requestId !== latestSearchRequestIdRef.current) return;
      setSearchMatches(res.data || []);
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (requestId !== latestSearchRequestIdRef.current) return;

      setServerError("Search failed");
      notifyError(err, "Search failed");
    } finally {
      if (
        requestId === latestSearchRequestIdRef.current &&
        !abortController.signal.aborted
      ) {
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

  useEffect(() => {
    if (!mapInstance || openingLakeFromRoute) return;

    scheduleBoundsFetch({ silent: true, immediate: true });

    const handleMoveLikeEvent = () => {
      if (!openingLakeFromRoute) {
        scheduleBoundsFetch({ silent: true, immediate: false });
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
    scheduleBoundsFetch({ silent: true, immediate: true });
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
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
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
    fetchWaterBodyById,
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
    () =>
      visibleLakes.filter((lake) => hasRenderableGeometry(lake.boundary))
        .length,
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
    mapInstance.flyTo(BULGARIA_CENTER, BULGARIA_ZOOM, { duration: 1.2 });
  }, [mapInstance]);

  const handleUseMyLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationError("");

      const nextLocation = await getCurrentUserLocation();

      setUserLocation(nextLocation);
      setMapUserLocation(nextLocation);

      if (shouldActivateDistanceAfterLocation) {
        setDistanceKm(String(sliderDistanceKm || DEFAULT_DISTANCE_KM));
        setShouldActivateDistanceAfterLocation(false);
        notifySuccess("Location detected and distance filter activated");
      } else {
        notifySuccess("Location detected. Nearest sorting is now available.");
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
  ]);

  const handleZoomToMyLocation = useCallback(async () => {
    try {
      const nextLocation = await getCurrentUserLocation();

      setMapUserLocation(nextLocation);
      setUserLocation(nextLocation);
      setSearchTerm("");
      setSearchMatches([]);
      setActiveLake(null);

      if (mapInstance) {
        const userLatLng = L.latLng(
          nextLocation.latitude,
          nextLocation.longitude,
        );

        const focusBounds = L.latLngBounds(
          [userLatLng.lat - 0.035, userLatLng.lng - 0.035],
          [userLatLng.lat + 0.035, userLatLng.lng + 0.035],
        );

        mapInstance.flyTo(userLatLng, 13, { duration: 1.2 });

        setTimeout(() => {
          mapInstance.fitBounds(focusBounds, {
            padding: [60, 60],
            maxZoom: 13,
          });
        }, 250);
      }
    } catch (error) {
      const message =
        error?.message === "Geolocation is not supported in this browser"
          ? error.message
          : getLocationErrorMessage(error);

      notifyError(null, message);
    }
  }, [getCurrentUserLocation, mapInstance]);

  const handleDistanceSliderChange = useCallback(
    (e) => {
      const nextValue = Number(e.target.value);
      setSliderDistanceKm(nextValue);

      if (distanceKm !== "ALL" && userLocation) {
        setDistanceKm(String(nextValue));
      }
    },
    [distanceKm, userLocation],
  );

  const handleEnableDistanceFilter = useCallback(() => {
    if (!userLocation) {
      setShouldActivateDistanceAfterLocation(true);
      handleUseMyLocation();
      return;
    }

    setDistanceKm(String(sliderDistanceKm));
  }, [userLocation, handleUseMyLocation, sliderDistanceKm]);

  const clearDistanceFilter = useCallback(() => {
    setUserLocation(null);
    setMapUserLocation(null);
    setLocationError("");
    setDistanceKm("ALL");
    setShouldActivateDistanceAfterLocation(false);

    if (sortBy === "nearest") {
      setSortBy("default");
    }
  }, [sortBy]);

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

  const distanceFilterActive = distanceKm !== "ALL";

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
        filteredLakes={visibleLakes}
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
      />
    </div>
  );
}

export default FishingMap;