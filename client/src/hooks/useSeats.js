import { useCallback, useEffect, useRef, useState } from 'react';
import { getSeats } from '../services/api.js';

/**
 * Live seat counter. Polls /api/registrations/seats every `intervalMs`.
 * @param {number} intervalMs default 30s
 */
export const useSeats = (intervalMs = 30000) => {
  const [seats, setSeats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSeats();
      setSeats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => clearInterval(timer.current);
  }, [refresh, intervalMs]);

  return { seats, loading, error, refresh };
};

export default useSeats;
