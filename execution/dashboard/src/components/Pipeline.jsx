/**
 * Pipeline — Kanban-style lead pipeline view.
 *
 * Displays leads grouped into 6 status columns (New, Queued, In Progress,
 * Follow Up, Committed, Closed).  Data is fetched from the backend
 * /api/dashboard/pipeline endpoint and refreshed every 30 seconds.
 *
 * Clicking any lead card opens the LeadSidePanel with full call history.
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { KANBAN_COLUMNS, POLL_PIPELINE } from "../constants";
import KanbanColumn from "./KanbanColumn";
import LeadSidePanel from "./LeadSidePanel";
import EmptyState from "./EmptyState";

/** Tailwind border-color class for each column key. */
const COLUMN_COLORS = {
  new: "border-blue-500",
  queued: "border-indigo-500",
  in_progress: "border-amber-500",
  follow_up: "border-yellow-500",
  committed: "border-green-500",
  closed: "border-gray-400",
};

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [error, setError] = useState(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const data = await apiFetch("/pipeline");
      if (data && data.leads) {
        setLeads(data.leads);
      }
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load pipeline");
    }
  }, []);

  // Initial fetch on mount.
  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Poll every 30 seconds.
  useInterval(fetchPipeline, POLL_PIPELINE);

  // Group leads into kanban columns.
  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((lead) => col.statuses.includes(lead.status)),
  }));

  const totalLeads = leads.length;

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {totalLeads === 0 && !error ? (
        <EmptyState
          title="No leads in pipeline"
          message="Import leads via CSV to get started."
        />
      ) : (
        /* Kanban board — horizontal scrollable */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.key}
              label={col.label}
              leads={col.leads}
              count={col.leads.length}
              colorClass={COLUMN_COLORS[col.key] || "border-gray-400"}
              onLeadClick={setSelectedLeadId}
            />
          ))}
        </div>
      )}

      {/* Side panel */}
      {selectedLeadId !== null && (
        <LeadSidePanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
