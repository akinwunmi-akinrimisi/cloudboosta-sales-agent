import LeadCard from "./LeadCard";

export default function KanbanColumn({ label, leads, count, colorClass, accentClass, onLeadClick }) {
  return (
    <div className="min-w-[250px] flex-shrink-0 flex flex-col glass-card">
      {/* Accent border */}
      <div className={`border-t-2 ${colorClass} rounded-t-xl`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h3 className={`text-sm font-semibold ${accentClass}`}>{label}</h3>
        <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400 min-w-[20px]">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
        ))}
      </div>
    </div>
  );
}
