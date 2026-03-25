/**
 * Active call hero card for the Live View tab.
 *
 * Shows a pulsing green indicator when a call is live, with lead details,
 * masked phone, recommended programme, and a live duration timer.
 * Falls back to a neutral "no active call" state when idle.
 */

import { useState, useEffect } from "react";
import { maskPhone, formatDuration } from "../constants";

export default function ActiveCallCard({ call }) {
  const [elapsed, setElapsed] = useState(0);

  // Live duration timer -- counts up from call.last_call_at
  useEffect(() => {
    if (!call?.last_call_at) {
      setElapsed(0);
      return;
    }

    function tick() {
      const start = new Date(call.last_call_at).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.last_call_at]);

  // Idle state
  if (!call) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
          </span>
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Active Call
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Waiting for next dial check...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isInCall = call.status === "in_call";
  const statusLabel = isInCall ? "In Call" : "Calling";
  const statusColor = isInCall
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border p-6 transition-all ${
        isInCall
          ? "border-green-500/50 shadow-md shadow-green-500/10"
          : "border-amber-400/50 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Left: indicator + info */}
        <div className="flex items-start gap-3">
          {/* Pulsing dot */}
          <span className="relative flex h-3 w-3 mt-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isInCall ? "bg-green-500 animate-ping" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isInCall ? "bg-green-500" : "bg-amber-400"
              }`}
            />
          </span>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {call.name || "Unknown Lead"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {maskPhone(call.phone)}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}
              >
                {statusLabel}
              </span>

              {call.programme_recommended && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {call.programme_recommended}
                </span>
              )}

              {call.last_strategy_used && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  {call.last_strategy_used}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: duration timer */}
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {formatDuration(elapsed)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Duration
          </p>
        </div>
      </div>
    </div>
  );
}
