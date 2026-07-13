import { useCallback, useRef, useState } from 'react';

export function useConfirmDialog() {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(options);
    });
  }, []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const dialogProps = {
    open: Boolean(dialog),
    title: dialog?.title ?? 'Confirm',
    message: dialog?.message ?? '',
    confirmLabel: dialog?.confirmLabel ?? 'Confirm',
    cancelLabel: dialog?.cancelLabel ?? 'Cancel',
    destructive: dialog?.destructive ?? false,
    onConfirm: () => close(true),
    onCancel: () => close(false),
  };

  return { confirm, dialogProps };
}
