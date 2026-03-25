/**
 * Compact lead card for the kanban pipeline board.
 *
 * Displays lead name, masked phone, relative time since last activity,
 * retry count badge, and outcome badge.  Clicking the card triggers
 * the side-panel detail view.
 */

import { maskPhone } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

/**
 * Compute a human-readable relative time string from an ISO timestamp.
 *
 * @param {string|null} isoString
 * @returns {string}  e.g. "2m ago", "5h ago", "3d ago"
 */
function relativeTime(isoString) {
  if (!isoString) return "";
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function LeadCard({ lead, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(lead.id)}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      {/* Name */}
      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
        {lead.name || "Unknown"}
      </p>

      {/* Masked phone */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {maskPhone(lead.phone)}
      </p>

      {/* Bottom row: relative time + retry badge */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {relativeTime(lead.updated_at)}
        </span>

        {lead.retry_count > 0 && (
          <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 text-xs font-medium">
            {lead.retry_count}
          </span>
        )}
      </div>

      {/* Outcome badge */}
      {lead.outcome && (
        <div className="mt-2">
          <OutcomeBadge outcome={lead.outcome} />
        </div>
      )}
    </button>
  );
}
