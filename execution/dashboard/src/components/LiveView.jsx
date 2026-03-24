/**
 * LiveView — Active call status, recent calls, today's stats, dialer controls.
 * TODO: Implement with real Supabase queries (Phase 6)
 */
export default function LiveView() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium mb-4">Active Call</h2>
        <p className="text-gray-500">No active call — waiting for next dial</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium mb-4">Recent Calls</h2>
        <p className="text-gray-500">No calls yet</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium mb-4">Today's Stats</h2>
        <p className="text-gray-500">No data available</p>
      </div>
    </div>
  );
}
