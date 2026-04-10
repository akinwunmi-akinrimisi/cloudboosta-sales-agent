import { STATUS_COLORS } from "../constants";

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";
  const label = (status || "unknown").replace(/_/g, " ");

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors}`}>
      {label}
    </span>
  );
}
