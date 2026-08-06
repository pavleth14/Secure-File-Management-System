export default function LeadActivityTabs({ value, onChange }) {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'non-active', label: 'Non-active' },
  ];

  return (
    <div
      className="inline-flex gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100/80 p-2 shadow-sm backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-700/80"
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
            className={`min-w-[5.5rem] rounded-lg px-10 py-2 text-sm font-medium transition-all duration-200 ${
              selected
                ? 'bg-white text-brand-700 shadow-md ring-2 ring-slate-200/70 dark:bg-slate-800 dark:text-brand-500 dark:ring-slate-500/50'
                : 'text-slate-500 hover:bg-white/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-500/50 dark:hover:text-slate-200'
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