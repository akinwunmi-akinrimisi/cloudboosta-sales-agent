import { formatRelativeTime } from "../constants";
import EmptyState from "./EmptyState";

function PhoneIcon() {
  return (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

function StatusArrowIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}

function ActivityItem({ item }) {
  const isCall = item.type === "call";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-glass-border last:border-0">
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
          isCall
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-blue-500/10 border border-blue-500/20"
        }`}
      >
        {isCall ? <PhoneIcon /> : <StatusArrowIcon />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-snug">
          <span className="font-semibold">{item.lead_name || "Unknown"}</span>{" "}
          <span className="text-zinc-400">{item.detail}</span>
        </p>
      </div>

      <span className="flex-shrink-0 font-mono text-[11px] text-zinc-600 whitespace-nowrap mt-0.5">
        {formatRelativeTime(item.timestamp)}
      </span>
    </div>
  );
}

export default function ActivityFeed({ activity }) {
  const hasActivity = activity && activity.length > 0;

  return (
    <div className="glass-card flex flex-col">
      <div className="px-4 py-3 border-b border-glass-border">
        <h3 className="label-mono text-zinc-400">Activity Feed</h3>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
        {hasActivity ? (
          <div className="px-4">
            {activity.map((item, idx) => (
              <ActivityItem key={idx} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            message="Call events and status changes will appear here."
          />
        )}
      </div>
    </div>
  );
}
