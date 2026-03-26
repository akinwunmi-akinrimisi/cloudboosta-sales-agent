import { OUTCOME_COLORS, OUTCOME_DEFAULT } from "../constants";

export default function OutcomeBadge({ outcome }) {
  if (!outcome) return null;

  const colors = OUTCOME_COLORS[outcome.toLowerCase()] || OUTCOME_DEFAULT;
  const label = outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
