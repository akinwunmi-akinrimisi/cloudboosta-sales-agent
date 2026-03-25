/**
 * Expandable recent calls table for the Live View tab.
 *
 * Shows a compact table of today's calls with time, lead name, duration,
 * and outcome badge. Clicking a row expands it to reveal call summary,
 * recording player, strategy used, and detected persona.
 */

import { useState } from "react";
import { formatTime, formatDuration } from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import EmptyState from "./EmptyState";

export default function RecentCallsTable({ calls }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!calls || calls.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <EmptyState
          title="No calls yet today"
          message="Recent calls will appear here once the auto-dialer starts."
        />
      </div>
    );
  }

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Recent Calls
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                Time
              </th>
              <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                Lead
              </th>
              <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                Duration
              </th>
              <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                expanded={expandedId === call.id}
                onToggle={() => toggleRow(call.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallRow({ call, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer even:bg-gray-50 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {formatTime(call.started_at)}
        </td>
        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
          {call.lead_name || "Unknown"}
        </td>
        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 tabular-nums">
          {formatDuration(call.duration_seconds)}
        </td>
        <td className="px-4 py-2.5">
          <OutcomeBadge outcome={call.outcome} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/80">
          <td colSpan={4} className="px-4 py-3">
            <div className="space-y-3 text-sm">
              {/* Summary */}
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Summary
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {call.summary || "No summary available"}
                </p>
              </div>

              {/* Recording player */}
              {call.recording_url && (
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recording
                  </p>
                  <audio
                    controls
                    src={call.recording_url}
                    className="w-full max-w-md"
                    preload="none"
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* Metadata row */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
                {call.closing_strategy_used && (
                  <span>
                    Strategy:{" "}
                    <span className="text-gray-600 dark:text-gray-300">
                      {call.closing_strategy_used}
                    </span>
                  </span>
                )}
                {call.detected_persona && (
                  <span>
                    Persona:{" "}
                    <span className="text-gray-600 dark:text-gray-300">
                      {call.detected_persona}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
