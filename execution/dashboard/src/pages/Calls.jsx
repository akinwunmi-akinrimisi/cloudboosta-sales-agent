import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, Play } from "lucide-react";
import { apiFetch } from "../api";
import DataTable from "../components/DataTable";
import FilterBar from "../components/FilterBar";
import StatusBadge from "../components/StatusBadge";
import { formatDuration, formatDateTime } from "../constants";

const PER_PAGE = 25;

const OUTCOME_OPTIONS = [
  { value: "committed", label: "Committed" },
  { value: "follow_up", label: "Follow Up" },
  { value: "declined", label: "Declined" },
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "busy", label: "Busy" },
];

const STRATEGY_OPTIONS = [
  { value: "social_proof", label: "Social Proof" },
  { value: "urgency", label: "Urgency" },
  { value: "consultative", label: "Consultative" },
  { value: "pain_point", label: "Pain Point" },
  { value: "value_ladder", label: "Value Ladder" },
  { value: "assumptive", label: "Assumptive" },
];

const COLUMNS = [
  {
    key: "started_at",
    label: "Date/Time",
    sortable: true,
    render: (v) => formatDateTime(v),
  },
  {
    key: "to_number",
    label: "Lead",
    sortable: false,
    render: (v) => v || "—",
  },
  {
    key: "duration_seconds",
    label: "Duration",
    sortable: true,
    render: (v) => formatDuration(v),
  },
  {
    key: "outcome",
    label: "Outcome",
    sortable: true,
    render: (v) => <StatusBadge status={v} />,
  },
  {
    key: "closing_strategy_used",
    label: "Strategy",
    sortable: false,
    render: (v) => v || "—",
  },
  {
    key: "detected_persona",
    label: "Persona",
    sortable: false,
    render: (v) => v || "—",
  },
];

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="label-mono text-zinc-500 whitespace-nowrap shrink-0">{label}</span>
      <span className="text-zinc-300 text-sm break-words">{value}</span>
    </div>
  );
}

function SlideOutPanel({ call, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!call?.id) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setLoading(true);

    apiFetch(`/calls/${call.id}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load call detail");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [call?.id]);

  const data = detail ?? call;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[480px] bg-surface border-l border-glass-border z-50 overflow-y-auto p-6 flex flex-col gap-5"
        role="dialog"
        aria-label="Call detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100">Call Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg p-1"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-zinc-700/50 rounded w-1/2" />
            <div className="h-4 bg-zinc-700/50 rounded w-3/4" />
            <div className="h-4 bg-zinc-700/50 rounded w-2/3" />
          </div>
        )}

        {/* Metadata */}
        {!loading && (
          <div className="glass-card p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="label-mono text-zinc-500">Outcome</span>
              <StatusBadge status={data.outcome} />
            </div>
            <MetaRow label="Strategy" value={data.closing_strategy_used} />
            <MetaRow label="Persona" value={data.detected_persona} />
            <MetaRow label="Duration" value={formatDuration(data.duration_seconds)} />
            <MetaRow label="Date" value={formatDateTime(data.started_at)} />
            <MetaRow label="Phone" value={data.to_number} />
            {data.lead_id && (
              <div className="flex items-center gap-2 pt-1">
                <span className="label-mono text-zinc-500">Lead</span>
                <Link
                  to={`/leads/${data.lead_id}`}
                  className="text-orange-400 hover:text-orange-300 text-sm underline underline-offset-2 transition-colors"
                  onClick={onClose}
                >
                  View Lead →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Audio player */}
        {!loading && data.recording_url && (
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 label-mono text-zinc-500">
              <Play className="w-3.5 h-3.5" />
              Recording
            </div>
            <audio
              controls
              src={data.recording_url}
              className="w-full accent-orange-500"
            />
          </div>
        )}

        {/* Transcript */}
        {!loading && data.transcript && (
          <div className="glass-card p-4 space-y-2 flex-1 flex flex-col min-h-0">
            <span className="label-mono text-zinc-500">Transcript</span>
            <div className="overflow-y-auto max-h-[420px] text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed bg-black/20 rounded-lg p-3 border border-glass-border">
              {data.transcript}
            </div>
          </div>
        )}

        {/* Empty transcript notice */}
        {!loading && !data.transcript && !data.recording_url && (
          <p className="text-xs text-zinc-600 italic">No transcript or recording available.</p>
        )}
      </div>
    </>
  );
}

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState(null);
  const [strategyFilter, setStrategyFilter] = useState(null);
  const [sortBy, setSortBy] = useState("started_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/calls?page=${page}&per_page=${PER_PAGE}&sort_by=${sortBy}&sort_order=${sortOrder}`;
      if (outcomeFilter) url += `&outcome=${encodeURIComponent(outcomeFilter)}`;
      if (strategyFilter) url += `&strategy=${encodeURIComponent(strategyFilter)}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const data = await apiFetch(url);
      setCalls(data.calls ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load calls");
      setCalls([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, outcomeFilter, strategyFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  function handleSort(key) {
    if (key === sortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  function handleFilterChange(key, value) {
    if (key === "outcome") {
      setOutcomeFilter(value || null);
      setPage(1);
    } else if (key === "strategy") {
      setStrategyFilter(value || null);
      setPage(1);
    }
  }

  function handleRowClick(row) {
    setSelectedCall(row);
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Calls</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {total > 0 ? `${total.toLocaleString()} calls total` : "Call history and transcripts"}
          </p>
        </div>
        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by lead name or phone..."
        filters={[
          {
            key: "outcome",
            label: "Outcome",
            value: outcomeFilter,
            options: OUTCOME_OPTIONS,
          },
          {
            key: "strategy",
            label: "Strategy",
            value: strategyFilter,
            options: STRATEGY_OPTIONS,
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {/* Data Table */}
      <DataTable
        columns={COLUMNS}
        data={calls}
        total={total}
        page={page}
        perPage={PER_PAGE}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={handleRowClick}
        loading={loading}
        emptyMessage="No calls found"
      />

      {/* Slide-out detail panel */}
      {selectedCall && (
        <SlideOutPanel
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
}
