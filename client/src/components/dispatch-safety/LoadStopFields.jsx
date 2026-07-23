import { inputClass } from './SafetyListToolbar';

export const emptyStop = () => ({
  date: '',
  time: '',
  address: '',
  city: '',
  state: '',
});

export const emptyLoadForm = () => ({
  customer: '',
  contact: '',
  customerLoadNumber: '',
  invoiceAmount: '',
  pickups: [emptyStop()],
  deliveries: [emptyStop()],
  truckId: '',
  trailerId: '',
  driverId: '',
  coDriverId: '',
  loadedMiles: '',
  emptyMiles: '',
});

export function StopFields({ stops, label, onChange, readOnly }) {
  return (
    <div className="space-y-4">
      {stops.map((stop, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {label} {index + 1}
            </h4>
            {!readOnly && stops.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(stops.filter((_, i) => i !== index))}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Date"
              type="date"
              value={stop.date}
              onChange={(value) =>
                onChange(stops.map((item, i) => (i === index ? { ...item, date: value } : item)))
              }
              readOnly={readOnly}
              required
            />
            <Field
              label="Time"
              type="time"
              value={stop.time}
              onChange={(value) =>
                onChange(stops.map((item, i) => (i === index ? { ...item, time: value } : item)))
              }
              readOnly={readOnly}
              required
            />
            <Field
              label="Address"
              value={stop.address}
              onChange={(value) =>
                onChange(stops.map((item, i) => (i === index ? { ...item, address: value } : item)))
              }
              readOnly={readOnly}
              required
              className="sm:col-span-2"
            />
            <Field
              label="City"
              value={stop.city}
              onChange={(value) =>
                onChange(stops.map((item, i) => (i === index ? { ...item, city: value } : item)))
              }
              readOnly={readOnly}
              required
            />
            <Field
              label="State"
              value={stop.state}
              onChange={(value) =>
                onChange(stops.map((item, i) => (i === index ? { ...item, state: value } : item)))
              }
              readOnly={readOnly}
              required
            />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...stops, emptyStop()])}
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          + Add {label}
        </button>
      )}
    </div>
  );
}

function Field({ label, value, onChange, readOnly, type = 'text', required = false, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

export { Field };
