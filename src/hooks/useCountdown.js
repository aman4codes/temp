import { useState, useEffect } from 'react';

/**
 * Custom React hook for live 15-minute countdowns
 * @param {number} expiresAt Timestamp in milliseconds
 */
export function useCountdown(expiresAt) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = remainingSeconds <= 0;
  const isUrgent = remainingSeconds < 180; // Less than 3 mins left

  return { remainingSeconds, isExpired, isUrgent };
}
