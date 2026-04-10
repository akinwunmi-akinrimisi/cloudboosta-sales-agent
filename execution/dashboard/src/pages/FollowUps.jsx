import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonCard } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useInterval } from "../hooks/useInterval";
import { Phone, Calendar, User } from "lucide-react";
import { formatDateTime } from "../constants";

const REFRESH_INTERVAL = 60_000;

/** Classify a follow-up record into one of four urgency buckets. */
function getUrgency(followUpAt) {
  if (!followUpAt) return "later";
  const now = new Date();
  const due = new Date(followUpAt);

  if (due < now) return "overdue";

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (due <= todayEnd) return "today";

  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (due <= weekEnd) return "this_week";

  return "later";
}

const URGENCY_CONFIG = {
  overdue: {
    label: "Overdue",
    borderClass: "border-l-4 border-red-500",
    dotClass: "bg-red-500",
    headerTextClass: "text-red-400",
  },
  today: {
    label: "Today",
    borderClass: "border-l-4 border-amber-500",
    dotClass: "bg-amber-500",
    headerTextClass: "text-amber-400",
  },
  this_week: {
    label: "This Week",
    borderClass: "border-l-4 border-blue-500",
    dotClass: "bg-blue-500",
    headerTextClass: "text-blue-400",
  },
  later: {
    label: "Later",
    borderClass: "border-l-4 border-zinc-600",
    dotClass: "bg-zinc-600",
    headerTextClass: "text-zinc-500",
  },
};

const URGENCY_ORDER = ["overdue", "today", "this_week", "later"];

/** Small pill chip for programme/strategy/persona metadata. */
function Chip({ label }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
      {label}
    </span>
  );
}

function FollowUpCard({ item, urgency }) {
  const navigate = useNavigate();
  const config = URGENCY_CONFIG[urgency];

  const displayName =
    item.name ||
    [item.first_name, item.last_name].filter(Boolean).join(" ") ||
    "Unknown";

  return (
    <div
      className={`glass-card p-4 mb-3 ${config.borderClass}`}
    >
      {/* Row 1: Name | Phone | Follow-up datetime */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-zinc-100 text-sm">{displayName}</span>
        <div className="flex items-center gap-4">
          {item.phone && (
            <span className="font-mono text-xs text-zinc-500">{item.phone}</span>
          )}
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{formatDateTime(item.follow_up_at)}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Last call summary */}
      {item.last_call_summary && (
        <p className="text-zinc-400 text-sm line-clamp-3 mb-3 leading-relaxed">
          {item.last_call_summary}
        </p>
      )}

      {/* Row 3: Chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.programme_recommended && (
          <Chip label={item.programme_recommended} />
        )}
        {item.last_strategy && <Chip label={item.last_strategy} />}
        {item.detected_persona && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
            <User className="w-3 h-3" />
            {item.detected_persona}
          </span>
        )}
        {item.last_objections && item.last_objections.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400">
            {item.last_objections.length} objection
            {item.last_objections.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Row 4: Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/leads/${item.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors
            bg-green-500/15 border border-green-500/30 text-green-400
            hover:bg-green-500/25 active:scale-95"
        >
          <Phone className="w-3.5 h-3.5" />
          Call Now
        </button>

        <button
          type="button"
          onClick={() => console.log("Reschedule", item.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors
            bg-amber-500/15 border border-amber-500/30 text-amber-400
            hover:bg-amber-500/25 active:scale-95"
        >
          <Calendar className="w-3.5 h-3.5" />
          Reschedule
        </button>

        <button
          type="button"
          onClick={() => navigate(`/leads/${item.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors
            bg-zinc-800 border border-zinc-700 text-zinc-400
            hover:bg-zinc-700 active:scale-95"
        >
          View Lead
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ urgency, count }) {
  const config = URGENCY_CONFIG[urgency];
  return (
    <h2
      className={`text-sm font-semibold ${config.headerTextClass} mb-3 flex items-center gap-2`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
      {config.label} ({count})
    </h2>
  );
}

function SkeletonFollowUpCard() {
  return (
    <div className="glass-card p-4 mb-3 border-l-4 border-zinc-700 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-4 w-32 bg-zinc-700 rounded" />
        <div className="h-4 w-24 bg-zinc-700 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-zinc-700 rounded" />
        <div className="h-3 w-4/5 bg-zinc-700 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-zinc-700 rounded-full" />
        <div className="h-5 w-16 bg-zinc-700 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-zinc-700 rounded-lg" />
        <div className="h-7 w-24 bg-zinc-700 rounded-lg" />
        <div className="h-7 w-20 bg-zinc-700 rounded-lg" />
      </div>
    </div>
  );
}

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFollowUps = useCallback(async () => {
    try {
      const data = await apiFetch("/leads/follow-ups");
      setFollowUps(data.follow_ups ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  useInterval(fetchFollowUps, REFRESH_INTERVAL);

  // Group follow-ups by urgency bucket
  const groups = followUps.reduce((acc, item) => {
    const urgency = getUrgency(item.follow_up_at);
    if (!acc[urgency]) acc[urgency] = [];
    acc[urgency].push(item);
    return acc;
  }, {});

  const totalCount = followUps.length;
  const hasAny = totalCount > 0;

  return (
    <div className="space-y-5 max-w-[900px]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Follow-Ups</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {loading
              ? "Loading…"
              : totalCount > 0
              ? `${totalCount} follow-up${totalCount !== 1 ? "s" : ""} scheduled`
              : "No follow-ups scheduled"}
          </p>
        </div>
        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="h-4 w-28 bg-zinc-700 rounded animate-pulse mb-3" />
              <SkeletonFollowUpCard />
              <SkeletonFollowUpCard />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasAny && (
        <EmptyState
          title="No follow-ups scheduled"
          message="Follow-ups will appear here once John flags leads for a callback."
        />
      )}

      {/* Urgency groups */}
      {!loading &&
        hasAny &&
        URGENCY_ORDER.map((urgency) => {
          const items = groups[urgency];
          if (!items || items.length === 0) return null;
          return (
            <section key={urgency}>
              <SectionHeader urgency={urgency} count={items.length} />
              {items.map((item) => (
                <FollowUpCard key={item.id} item={item} urgency={urgency} />
              ))}
            </section>
          );
        })}
    </div>
  );
}
