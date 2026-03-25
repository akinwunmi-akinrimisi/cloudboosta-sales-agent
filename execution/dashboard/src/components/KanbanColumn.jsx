/**
 * Single kanban column for the pipeline board.
 *
 * Renders a vertical column with a colored top accent border,
 * a header showing the label and lead count, and a scrollable
 * body containing LeadCard components.
 */

import LeadCard from "./LeadCard";

export default function KanbanColumn({ label, leads, count, colorClass, onLeadClick }) {
  return (
    <div className="min-w-[250px] flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      {/* Accent border */}
      <div className={`border-t-2 ${colorClass} rounded-t-lg`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </h3>
        <span className="inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 text-xs font-medium min-w-[20px]">
          {count}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
        ))}
      </div>
    </div>
  );
}
