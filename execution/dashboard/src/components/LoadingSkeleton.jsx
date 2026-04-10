export function SkeletonCard({ className = "" }) {
  return (
    <div className={`glass-card p-4 animate-pulse ${className}`}>
      <div className="h-3 w-20 bg-zinc-700 rounded mb-3" />
      <div className="h-6 w-16 bg-zinc-700 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="h-4 w-32 bg-zinc-700 rounded" />
      <div className="h-4 w-24 bg-zinc-700 rounded" />
      <div className="h-4 w-16 bg-zinc-700 rounded" />
      <div className="h-4 w-20 bg-zinc-700 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
