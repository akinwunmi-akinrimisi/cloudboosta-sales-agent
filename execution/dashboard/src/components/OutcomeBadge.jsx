/**
 * Color-coded outcome badge for call results.
 *
 * Renders a small pill with a dot indicator and the outcome text.
 * Colors are driven by OUTCOME_COLORS in constants.js.
 */

import { OUTCOME_COLORS, OUTCOME_DEFAULT } from "../constants";

export default function OutcomeBadge({ outcome }) {
  if (!outcome) return null;

  const colors = OUTCOME_COLORS[outcome.toLowerCase()] || OUTCOME_DEFAULT;
  const label = outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
