import { useCallback, useEffect, useState } from "react";
import { getMyCatches } from "../api/myCatchesApi";

export default function useMyCatches() {
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getMyCatches();
      setCatches(data || []);
    } catch (err) {
      setCatches([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data ||
          "Failed to load catches",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    catches,
    loading,
    error,
    reload: load,
  };
}