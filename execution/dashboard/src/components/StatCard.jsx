/**
 * Reusable stat card for dashboard metric display.
 *
 * Renders a compact card with a label, large value, and optional subtitle.
 * Color prop controls the value text color.
 */

const COLOR_MAP = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  purple: "text-purple-600 dark:text-purple-400",
};

export default function StatCard({ label, value, subtitle, color = "blue" }) {
  const valueColor = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
        {label}
      </p>
      <p className={`text-3xl font-bold mt-1 ${valueColor}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
