/**
 * Shared constants for Sarah Dashboard.
 *
 * Kanban column definitions, outcome badge colors, polling intervals,
 * and utility formatters used across all 3 tabs.
 */

/** Kanban column definitions for the pipeline view. */
export const KANBAN_COLUMNS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "enriched", label: "Enriched", statuses: ["enriched"] },
  { key: "outreach", label: "Outreach", statuses: ["outreach_sent", "outreach_no_response"] },
  { key: "scheduled", label: "Scheduled", statuses: ["call_scheduled"] },
  { key: "queued", label: "Queued", statuses: ["queued"] },
  { key: "in_progress", label: "In Progress", statuses: ["calling", "in_call"] },
  { key: "committed", label: "Committed", statuses: ["committed", "payment_pending", "payment_sent"] },
  { key: "follow_up", label: "Follow Up", statuses: ["follow_up", "follow_up_scheduled"] },
  { key: "enrolled", label: "Enrolled", statuses: ["enrolled"] },
  {
    key: "closed",
    label: "Closed",
    statuses: ["declined", "not_qualified", "do_not_contact", "failed", "exhausted", "invalid_number"],
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

export const POLL_COMMAND = 5000;

export const FUNNEL_STAGES = [
  { key: "new", label: "New", color: "#3b82f6" },
  { key: "queued", label: "Queued", color: "#8b5cf6" },
  { key: "in_progress", label: "In Progress", color: "#f97316" },
  { key: "follow_up", label: "Follow Up", color: "#60a5fa" },
  { key: "committed", label: "Committed", color: "#22c55e" },
  { key: "closed", label: "Closed", color: "#52525b" },
];

export const STATUS_COLORS = {
  new: "bg-blue-500/15 border-blue-500/30 text-blue-500",
  enriched: "bg-cyan-500/15 border-cyan-500/30 text-cyan-500",
  outreach_sent: "bg-purple-500/15 border-purple-500/30 text-purple-500",
  outreach_no_response: "bg-purple-400/15 border-purple-400/30 text-purple-400",
  call_scheduled: "bg-teal-500/15 border-teal-500/30 text-teal-500",
  queued: "bg-violet-500/15 border-violet-500/30 text-violet-500",
  calling: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  in_call: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  committed: "bg-green-500/15 border-green-500/30 text-green-500",
  follow_up: "bg-blue-400/15 border-blue-400/30 text-blue-400",
  follow_up_scheduled: "bg-blue-400/15 border-blue-400/30 text-blue-400",
  payment_pending: "bg-amber-500/15 border-amber-500/30 text-amber-500",
  payment_sent: "bg-green-500/15 border-green-500/30 text-green-500",
  enrolled: "bg-emerald-500/15 border-emerald-500/30 text-emerald-500",
  declined: "bg-red-500/15 border-red-500/30 text-red-500",
  not_qualified: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  no_answer: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  voicemail: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  busy: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  exhausted: "bg-zinc-600/15 border-zinc-600/30 text-zinc-500",
  invalid_number: "bg-red-600/15 border-red-600/30 text-red-400",
  do_not_contact: "bg-red-700/15 border-red-700/30 text-red-300",
  failed: "bg-zinc-600/15 border-zinc-600/30 text-zinc-500",
};

export function formatRelativeTime(isoString) {
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

export function formatDateTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + formatTime(isoString);
  } catch {
    return "";
  }
}
