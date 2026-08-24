import { useState } from 'react';
import {
  PASSWORD_REQUIREMENTS_HINT,
  PASSWORD_INVALID_MESSAGE,
  canSubmitPasswordChange,
} from '../utils/passwordValidation';

export default function ChangePasswordForm({
  title = 'Change password',
  description,
  showCurrentPassword = false,
  submitLabel = 'Save password',
  onSubmit,
  onSuccess,
  compact = false,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSave =
    canSubmitPasswordChange(newPassword, confirmPassword) &&
    (!showCurrentPassword || currentPassword.length > 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!canSubmitPasswordChange(newPassword, confirmPassword)) {
      setError(
        newPassword !== confirmPassword
          ? 'Passwords do not match.'
          : PASSWORD_INVALID_MESSAGE
      );
      return;
    }

    if (showCurrentPassword && !currentPassword) {
      setError('Current password is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        currentPassword: showCurrentPassword ? currentPassword : undefined,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully.');
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30';

  const inputClassLight =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500';

  const fieldClass = compact ? inputClassLight : inputClass;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <h2
          className={
            compact
              ? 'text-lg font-semibold text-slate-900 dark:text-slate-100'
              : 'text-lg font-semibold text-white'
          }
        >
          {title}
        </h2>
        {description ? (
          <p
            className={
              compact
                ? 'mt-1 text-sm text-slate-500 dark:text-slate-400'
                : 'mt-1 text-sm text-white/70'
            }
          >
            {description}
          </p>
        ) : null}
        <p
          className={
            compact
              ? 'mt-2 text-xs text-slate-500 dark:text-slate-400'
              : 'mt-2 text-xs text-white/60'
          }
        >
          {PASSWORD_REQUIREMENTS_HINT}
        </p>
      </div>

      {showCurrentPassword && (
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          className={fieldClass}
        />
      )}

      <input
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        className={fieldClass}
      />

      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirm new password"
        autoComplete="new-password"
        className={fieldClass}
      />

      {error ? (
        <p
          className={
            compact
              ? 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100'
          }
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className={
            compact
              ? 'rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-100'
          }
        >
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSave || submitting}
        className={
          compact
            ? 'w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50'
            : 'w-full rounded-lg border border-white/30 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
