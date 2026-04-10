import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch, apiPost } from "../api";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useInterval } from "../hooks/useInterval";
import { formatDateTime } from "../constants";
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from "lucide-react";

/* ─── Constants ─── */

const POLL_MS = 30_000;

const COMPONENT_COLORS = {
  retell: "bg-orange-500/15 text-orange-500",
  n8n: "bg-purple-500/15 text-purple-500",
  openclaw: "bg-green-500/15 text-green-500",
  cal_com: "bg-teal-500/15 text-teal-500",
  resend: "bg-blue-500/15 text-blue-500",
  backend: "bg-zinc-500/15 text-zinc-400",
  status_transition: "bg-violet-500/15 text-violet-500",
  dashboard: "bg-amber-500/15 text-amber-500",
};

/* ─── Helpers ─── */

function ComponentBadge({ component }) {
  const cls =
    COMPONENT_COLORS[component?.toLowerCase()] ??
    "bg-zinc-500/15 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono ${cls}`}
    >
      {component ?? "unknown"}
    </span>
  );
}

/* ─── Error Card ─── */

function ErrorCard({ error, onResolved }) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const isResolved = error.status === "resolved" || error.details?.resolved === true;

  async function handleResolve(e) {
    e.stopPropagation();
    setResolving(true);
    setResolveError(null);
    try {
      await apiPost(`/errors/${error.id}/resolve`);
      onResolved();
    } catch (err) {
      setResolveError(err.message || "Failed to resolve");
    } finally {
      setResolving(false);
    }
  }

  const borderColor = isResolved
    ? "border-l-4 border-zinc-700"
    : "border-l-4 border-red-500";

  const cardOpacity = isResolved ? "opacity-60" : "";

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`glass-card p-4 mb-2 ${borderColor} ${cardOpacity} transition-all`}
    >
      {/* Row 1: Timestamp | Component badge | Lead name */}
      <div
        className="flex flex-wrap items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span className="text-xs text-zinc-500 font-mono tabular-nums whitespace-nowrap">
          {formatDateTime(error.created_at) || "—"}
        </span>

        <ComponentBadge component={error.component} />

        {error.lead_id ? (
          <Link
            to={`/leads/${error.lead_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-2"
          >
            {error.lead_name || "Unknown Lead"}
          </Link>
        ) : (
          <span className="text-sm font-medium text-zinc-400">
            {error.lead_name || "—"}
          </span>
        )}

        {/* spacer */}
        <span className="ml-auto" />

        <ChevronIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
      </div>

      {/* Row 2: Event / error message */}
      <div className="mt-2">
        <p
          className={`text-sm leading-relaxed ${
            isResolved ? "text-zinc-500" : "text-zinc-200 font-semibold"
          }`}
        >
          {error.event || "Unknown event"}
        </p>
      </div>

      {/* Row 3: Mark Resolved + expand/collapse hint */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {!isResolved && (
          <button
            type="button"
            disabled={resolving}
            onClick={handleResolve}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {resolving ? "Resolving…" : "Mark Resolved"}
          </button>
        )}

        {resolveError && (
          <span className="text-xs text-red-400 font-mono">{resolveError}</span>
        )}

        {isResolved && error.details?.resolved_at && (
          <span className="text-xs text-zinc-600 font-mono">
            Resolved {formatDateTime(error.details.resolved_at)}
          </span>
        )}
      </div>

      {/* Row 4: Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-black/30 border border-glass-border p-3 overflow-x-auto">
            <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(error.details ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

export default function Errors() {
  const [errors, setErrors] = useState([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchErrors = useCallback(async () => {
    try {
      const data = await apiFetch("/errors");
      setErrors(data.errors ?? []);
      setUnresolvedCount(data.unresolved_count ?? 0);
      setTotal(data.total ?? 0);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || "Failed to load errors");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Auto-refresh every 30s
  useInterval(fetchErrors, POLL_MS);

  // Split into unresolved / resolved
  const unresolved = errors.filter(
    (e) => e.status !== "resolved" && !e.details?.resolved
  );
  const resolved = errors.filter(
    (e) => e.status === "resolved" || e.details?.resolved === true
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-50">Errors</h1>
              {!loading && unresolvedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 border border-red-500/30 text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {unresolvedCount} unresolved
                </span>
              )}
              {!loading && unresolvedCount === 0 && total > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/15 border border-green-500/25 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  All clear
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-0.5">
              {loading
                ? "Loading…"
                : total > 0
                ? `${total} error${total !== 1 ? "s" : ""} total · refreshes every 30s`
                : "System error log"}
            </p>
          </div>
        </div>

        {fetchError && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {fetchError}
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card px-4 py-3">
          <SkeletonTable rows={6} />
        </div>
      )}

      {/* Empty state */}
      {!loading && errors.length === 0 && (
        <div className="glass-card">
          <EmptyState
            title="No errors logged"
            message="System errors will appear here when components encounter issues."
          />
        </div>
      )}

      {/* Unresolved section */}
      {!loading && unresolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono mb-3">
            Unresolved
            <span className="ml-2 text-red-400 normal-case">
              ({unresolved.length})
            </span>
          </h2>
          <div>
            {unresolved.map((err) => (
              <ErrorCard key={err.id} error={err} onResolved={fetchErrors} />
            ))}
          </div>
        </section>
      )}

      {/* Resolved section */}
      {!loading && resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono mb-3">
            Resolved
            <span className="ml-2 normal-case">({resolved.length})</span>
          </h2>
          <div>
            {resolved.map((err) => (
              <ErrorCard key={err.id} error={err} onResolved={fetchErrors} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
