export default function LeadActivityTabs({ value, onChange }) {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'non-active', label: 'Non-active' },
  ];

  return (
    <div
      className="inline-flex rounded-lg border-2 border-slate-300 bg-slate-100 p-1 shadow-sm dark:border-slate-500 dark:bg-slate-800"
      role="group"
      aria-label="Lead activity filter"
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`min-w-[5.5rem] rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              selected
                ? 'border border-slate-300 bg-white text-brand-700 shadow-sm dark:border-slate-500 dark:bg-slate-900 dark:text-brand-300'
                : 'border border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
            }`}
            aria-pressed={selected}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
