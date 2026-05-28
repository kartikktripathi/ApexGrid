import { useState, useEffect, useCallback } from "react";
import { f1Api } from "../utils/api";

export function useF1Fetch(fetchFn, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const execute = async () => {
      if (isMounted) {
        setLoading(true);
      }
      try {
        const result = await fetchFn();
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("API Fetch Error:", err);
        if (isMounted) {
          timerId = setTimeout(execute, 10000);
        }
      }
    };

    execute();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, loading, error: null, refetch: () => {} };
}

// Specific hooks
export function useDrivers(sessionKey = "latest") {
  return useF1Fetch(() => f1Api.getDrivers(sessionKey), [sessionKey]);
}

export function useChampionshipDrivers(sessionKey = "latest") {
  return useF1Fetch(
    () => f1Api.getChampionshipDrivers(sessionKey),
    [sessionKey],
  );
}

export function useChampionshipTeams(sessionKey = "latest") {
  return useF1Fetch(() => f1Api.getChampionshipTeams(sessionKey), [sessionKey]);
}

export function useMeetings(year) {
  return useF1Fetch(() => f1Api.getMeetings(year), [year]);
}

export function useSessions(year) {
  return useF1Fetch(() => f1Api.getSessions(year), [year]);
}
