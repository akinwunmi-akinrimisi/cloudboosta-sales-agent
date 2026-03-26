/**
 * Shared constants for Sarah Dashboard.
 *
 * Kanban column definitions, outcome badge colors, polling intervals,
 * and utility formatters used across all 3 tabs.
 */

/** Kanban column definitions for the pipeline view. */
export const KANBAN_COLUMNS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "queued", label: "Queued", statuses: ["queued"] },
  { key: "in_progress", label: "In Progress", statuses: ["calling", "in_call"] },
  { key: "follow_up", label: "Follow Up", statuses: ["follow_up"] },
  { key: "committed", label: "Committed", statuses: ["committed", "payment_sent"] },
  {
    key: "closed",
    label: "Closed",
    statuses: ["declined", "not_qualified", "do_not_contact", "failed"],
  },
];

/** Dark Glass badge styles: translucent bg + colored border + colored text. */
export const OUTCOME_COLORS = {
  committed: {
    bg: "bg-green-500/15 border border-green-500/30",
    text: "text-green-500",
    dot: "bg-green-500",
  },
  follow_up: {
    bg: "bg-blue-500/15 border border-blue-500/30",
    text: "text-blue-500",
    dot: "bg-blue-500",
  },
  declined: {
    bg: "bg-red-500/15 border border-red-500/30",
    text: "text-red-500",
    dot: "bg-red-500",
  },
  no_answer: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  voicemail: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  busy: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
};

/** Default style for unknown outcomes. */
export const OUTCOME_DEFAULT = {
  bg: "bg-zinc-500/15 border border-zinc-500/30",
  text: "text-zinc-400",
  dot: "bg-zinc-500",
};

/** Polling intervals (ms). */
export const POLL_LIVE = 5000;
export const POLL_PIPELINE = 30000;
export const POLL_STRATEGY = 30000;

/**
 * Mask a phone number for display (privacy).
 * "+1740508####" -> "+174****60"
 *
 * @param {string|null} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone || "";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

/**
 * Format seconds as mm:ss or hh:mm:ss.
 *
 * @param {number|null} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return "0:00";
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/**
 * Format an ISO timestamp as a short locale time string.
 *
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
