export default function LeadActivityTabs({ value, onChange }) {
  const tabs = [
    { id: 'active', label: 'Active' },
    { id: 'non-active', label: 'Non-active' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
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
