/**
 * Declarative setInterval hook (Dan Abramov pattern).
 *
 * Uses a ref to avoid stale closures -- the latest callback is always called.
 * Pass null for delay to pause the interval.
 *
 * @param {Function} callback - Function to call on each tick.
 * @param {number|null} delay - Interval in ms, or null to pause.
 */
import { useEffect, useRef } from "react";

export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  // Remember the latest callback without restarting the interval.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    if (delay === null || delay === undefined) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}
