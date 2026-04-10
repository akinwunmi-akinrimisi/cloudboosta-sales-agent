import { useState, useEffect, useCallback, useMemo } from "react";
import { legacyFetch as apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { KANBAN_COLUMNS, POLL_PIPELINE } from "../constants";
import KanbanColumn from "./KanbanColumn";
import EmptyState from "./EmptyState";

const COLUMN_COLORS = {
  new: "border-blue-500",
  queued: "border-violet-500",
  in_progress: "border-orange-500",
  follow_up: "border-blue-400",
  committed: "border-green-500",
  closed: "border-zinc-600",
};

const COLUMN_ACCENT = {
  new: "text-blue-500",
  queued: "text-violet-500",
  in_progress: "text-orange-500",
  follow_up: "text-blue-400",
  committed: "text-green-500",
  closed: "text-zinc-500",
};

export default function Pipeline({ onNavigateToLead }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const data = await apiFetch("/pipeline");
      if (data && data.leads) setLeads(data.leads);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load pipeline");
    }
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);
  useInterval(fetchPipeline, POLL_PIPELINE);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.trim().toLowerCase();
    return leads.filter(
      (lead) =>
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)) ||
        (lead.programme_recommended && lead.programme_recommended.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    leads: filteredLeads.filter((lead) => col.statuses.includes(lead.status)),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-card border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or programme…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/40"
        />
      </div>

      {leads.length === 0 && !error ? (
        <EmptyState title="No leads in pipeline" message="Import leads via CSV to get started." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.key}
              label={col.label}
              leads={col.leads}
              count={col.leads.length}
              colorClass={COLUMN_COLORS[col.key] || "border-zinc-600"}
              accentClass={COLUMN_ACCENT[col.key] || "text-zinc-500"}
              onLeadClick={onNavigateToLead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
