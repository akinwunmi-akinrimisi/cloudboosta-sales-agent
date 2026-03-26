import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { KANBAN_COLUMNS, POLL_PIPELINE } from "../constants";
import KanbanColumn from "./KanbanColumn";
import LeadSidePanel from "./LeadSidePanel";
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

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
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

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((lead) => col.statuses.includes(lead.status)),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-card border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

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
              onLeadClick={setSelectedLeadId}
            />
          ))}
        </div>
      )}

      {selectedLeadId !== null && (
        <LeadSidePanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}
