import { useEffect } from "react";
import { useMap } from "react-leaflet";

const MapRecenter = ({ activeLake }) => {
  const map = useMap();

  useEffect(() => {
    if (!activeLake) return;
    const lat = Number(activeLake.latitude);
    const lng = Number(activeLake.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], 12, { duration: 1.8 });
  }, [activeLake, map]);

  return null;
};

export default MapRecenter;