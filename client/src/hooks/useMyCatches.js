import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { notifyError } from "../ui/toast";

export default function useMyCatches() {
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (opts = {}) => {
    const { silent = false } = opts;

    setLoading(true);
    setError("");

    try {
      const res = await api.get("/catches/my");
      setCatches(res.data || []);
    } catch (err) {
      setError("Failed to load catch logs");
      if (!silent) notifyError(err, "Failed to load catch logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await api.get("/catches/my");
        if (!alive) return;
        setCatches(res.data || []);
      } catch (err) {
        if (!alive) return;
        setError("Failed to load catch logs");
        notifyError(err, "Failed to load catch logs");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(() => load({ silent: false }), [load]);

  return { catches, loading, error, reload };
}