import { useState } from "react";
import LiveView from "./components/LiveView";
import Pipeline from "./components/Pipeline";
import StrategyAnalytics from "./components/StrategyAnalytics";

const TABS = ["Live View", "Lead Pipeline", "Strategy Analytics"];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <h1 className="text-xl font-semibold">Sarah — Cloudboosta Sales Agent</h1>
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-1 px-6 pt-4">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeTab === i
                ? "bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-700"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className="px-6 py-4">
        {activeTab === 0 && <LiveView />}
        {activeTab === 1 && <Pipeline />}
        {activeTab === 2 && <StrategyAnalytics />}
      </main>
    </div>
  );
}
