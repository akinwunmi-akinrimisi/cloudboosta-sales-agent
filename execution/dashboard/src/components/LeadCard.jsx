import { maskPhone, formatRelativeTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

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

      {/* Programme + Persona badges */}
      {(lead.programme_recommended || lead.detected_persona) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.programme_recommended && (
            <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 px-1.5 py-0.5 text-xs font-mono truncate max-w-[140px]">
              {lead.programme_recommended}
            </span>
          )}
          {lead.detected_persona && (
            <span className="inline-flex items-center rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 px-1.5 py-0.5 text-xs font-mono">
              {lead.detected_persona.replace(/_/g, " ")}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-600 font-mono">
          {formatRelativeTime(lead.updated_at)}
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
