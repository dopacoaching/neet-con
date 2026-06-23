import { useEffect, useState } from 'react';
import { getSeats } from '../services/api.js';

/**
 * Live seat counter.
 *
 * All consumers share ONE polling loop via a module-level store, so mounting
 * the badge, the registration page and the hero at once does not spin up three
 * independent intervals hammering /api/registrations/seats.
 */
let state = { seats: null, loading: true, error: null };
const subscribers = new Set();
let intervalId = null;
let activeInterval = null;
let inFlight = null;

const notify = () => subscribers.forEach((fn) => fn(state));

const refresh = async () => {
  // Coalesce concurrent refreshes into a single request.
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const data = await getSeats();
      state = { seats: data, loading: false, error: null };
    } catch (err) {
      state = { ...state, loading: false, error: err.message };
    } finally {
      inFlight = null;
    }
    notify();
  })();
  return inFlight;
};

const ensurePolling = (intervalMs) => {
  if (intervalId && activeInterval === intervalMs) return;
  if (intervalId) clearInterval(intervalId);
  activeInterval = intervalMs;
  intervalId = setInterval(refresh, intervalMs);
};

/**
 * @param {number} intervalMs default 30s
 */
export const useSeats = (intervalMs = 30000) => {
  const [local, setLocal] = useState(state);

  useEffect(() => {
    subscribers.add(setLocal);
    setLocal(state); // hand the new consumer whatever we already have
    ensurePolling(intervalMs);
    if (state.seats === null) refresh(); // first mount kicks an immediate load

    return () => {
      subscribers.delete(setLocal);
      if (subscribers.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        activeInterval = null;
      }
    };
  }, [intervalMs]);

  return { seats: local.seats, loading: local.loading, error: local.error, refresh };
};

export default useSeats;
