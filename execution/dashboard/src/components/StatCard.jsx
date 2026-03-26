const COLOR_MAP = {
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-orange-500",
  purple: "text-violet-500",
};

export default function StatCard({ label, value, subtitle, color = "blue" }) {
  const valueColor = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="glass-card glass-card-hover p-4">
      <p className="label-mono">{label}</p>
      <p className={`value-lg mt-1 ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
