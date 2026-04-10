import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import FilterBar from "../components/FilterBar";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useInterval } from "../hooks/useInterval";
import { formatDateTime } from "../constants";
import { ChevronDown, ChevronRight } from "lucide-react";

/* ─── Constants ─── */

const PER_PAGE = 25;
const REFRESH_MS = 30_000;

const COMPONENT_OPTIONS = [
  { value: "retell", label: "Retell" },
  { value: "n8n", label: "n8n" },
  { value: "openclaw", label: "OpenClaw" },
  { value: "cal_com", label: "Cal.com" },
  { value: "resend", label: "Resend" },
  { value: "backend", label: "Backend" },
  { value: "status_transition", label: "Status Transition" },
];

/** Tailwind classes for each component pill */
const BADGE_STYLES = {
  retell: "bg-orange-500/15 border-orange-500/30 text-orange-400",
  n8n: "bg-purple-500/15 border-purple-500/30 text-purple-400",
  openclaw: "bg-green-500/15 border-green-500/30 text-green-400",
  cal_com: "bg-teal-500/15 border-teal-500/30 text-teal-400",
  resend: "bg-blue-500/15 border-blue-500/30 text-blue-400",
  backend: "bg-zinc-500/15 border-zinc-600/40 text-zinc-400",
  status_transition: "bg-violet-500/15 border-violet-500/30 text-violet-400",
};

const DEFAULT_BADGE = "bg-zinc-700/40 border-zinc-600/30 text-zinc-400";

/* ─── Sub-components ─── */

function ComponentBadge({ component }) {
  const cls = BADGE_STYLES[component] ?? DEFAULT_BADGE;
  const label =
    COMPONENT_OPTIONS.find((o) => o.value === component)?.label ?? component;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);
  const isError = log.status === "error";

  const borderCls = isError
    ? "border-l-4 border-red-500"
    : "border-l-4 border-transparent";

  return (
    <div
      className={`glass-card p-4 mb-2 cursor-pointer select-none transition-colors hover:bg-white/[0.03] ${borderCls}`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      aria-expanded={expanded}
    >
      {/* Row 1: timestamp | component badge | lead name | chevron */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-zinc-500 whitespace-nowrap">
          {formatDateTime(log.created_at) || "—"}
        </span>
        <ComponentBadge component={log.component} />
        {log.lead_name && log.lead_id ? (
          <Link
            to={`/leads/${log.lead_id}`}
            className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {log.lead_name}
          </Link>
        ) : log.lead_name ? (
          <span className="text-xs text-zinc-300">{log.lead_name}</span>
        ) : null}
        <span className="ml-auto text-zinc-600">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      {/* Row 2: event description */}
      <p className="mt-1.5 text-sm text-zinc-300 leading-snug">{log.event}</p>

      {/* Row 3 (expanded): details JSON */}
      {expanded && log.details && (
        <pre className="mt-3 p-3 rounded-lg bg-zinc-800/50 text-xs text-zinc-400 font-mono overflow-x-auto max-h-48">
          {JSON.stringify(log.details, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SkeletonEntry() {
  return (
    <div className="glass-card p-4 mb-2 border-l-4 border-transparent animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-3.5 w-28 rounded bg-zinc-700/50" />
        <div className="h-5 w-16 rounded-full bg-zinc-700/50" />
        <div className="h-3.5 w-20 rounded bg-zinc-700/50" />
      </div>
      <div className="mt-2 h-3.5 w-3/4 rounded bg-zinc-700/40" />
    </div>
  );
}

/* ─── Main Page ─── */

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [componentFilter, setComponentFilter] = useState(null);
  const [eventSearch, setEventSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasMore = page < totalPages;

  /** Build query string from current filter state */
  function buildUrl(overridePage) {
    const p = overridePage ?? page;
    const params = new URLSearchParams({
      page: String(p),
      per_page: String(PER_PAGE),
    });
    if (componentFilter) params.set("component", componentFilter);
    if (eventSearch.trim()) params.set("event", eventSearch.trim());
    return `/pipeline/log?${params.toString()}`;
  }

  /** Full refresh — replace existing logs */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(buildUrl(1));
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPage(1);
    } catch (err) {
      setError(err.message || "Failed to load activity log");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentFilter, eventSearch]);

  /** Append next page */
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await apiFetch(buildUrl(nextPage));
      setLogs((prev) => [...prev, ...(data.logs ?? [])]);
      setTotal(data.total ?? total);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  /* Initial load + re-fetch when filters change */
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /* Auto-refresh every 30 s (resets to page 1 on refresh) */
  useInterval(fetchLogs, REFRESH_MS);

  function handleFilterChange(key, value) {
    if (key === "component") {
      setComponentFilter(value || null);
    }
  }

  function handleSearchChange(value) {
    setEventSearch(value);
  }

  return (
    <div className="space-y-5 max-w-[900px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Activity</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {total > 0
              ? `${total.toLocaleString()} pipeline event${total !== 1 ? "s" : ""}`
              : "Pipeline activity log — all components"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live pulse indicator */}
          <span className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live (30s)
          </span>

          {error && (
            <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        searchValue={eventSearch}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search events..."
        filters={[
          {
            key: "component",
            label: "Component",
            value: componentFilter,
            options: COMPONENT_OPTIONS,
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {/* Feed */}
      {loading ? (
        <div>
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonEntry key={i} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No activity yet"
          message="Pipeline events from all components will appear here."
        />
      ) : (
        <div>
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}

          {/* Pagination controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-600 font-mono">
              Showing {logs.length} of {total}
            </span>

            <div className="flex items-center gap-2">
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-1.5 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
