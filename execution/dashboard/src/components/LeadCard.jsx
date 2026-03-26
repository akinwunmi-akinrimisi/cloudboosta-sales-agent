import { maskPhone } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

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
      className="w-full text-left bg-white/[0.03] rounded-lg border border-glass-border p-3 cursor-pointer hover:border-glass-border-hover hover:bg-white/[0.05] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/30"
    >
      <p className="font-medium text-sm text-zinc-100 truncate">
        {lead.name || "Unknown"}
      </p>
      <p className="text-xs text-zinc-500 font-mono mt-0.5">
        {maskPhone(lead.phone)}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-600 font-mono">
          {relativeTime(lead.updated_at)}
        </span>
        {lead.retry_count > 0 && (
          <span className="inline-flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-500 px-1.5 text-xs font-mono">
            {lead.retry_count}
          </span>
        )}
      </div>

      {lead.outcome && (
        <div className="mt-2">
          <OutcomeBadge outcome={lead.outcome} />
        </div>
      )}
    </button>
  );
}
