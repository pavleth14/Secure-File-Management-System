import { useRef, useState, useCallback } from 'react';
import { UploadCloudIcon } from './icons';
import { partitionUploadFiles } from '../utils/uploadTypes';

/**
 * Drag & drop upload zone with a click-to-browse fallback. Wraps arbitrary
 * children (e.g. the file table) and shows a Google-Drive-style overlay while
 * a drag is in progress. Supports selecting multiple files at once.
 *
 * @param {object} props
 * @param {(files: File[]) => void} props.onFiles - called with dropped/picked files
 * @param {(messages: string[]) => void} [props.onValidationError]
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} props.children
 */
export default function UploadDropzone({ onFiles, onValidationError, disabled, children }) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const processFiles = useCallback(
    (fileList) => {
      const { accepted, rejected } = partitionUploadFiles(fileList);
      if (rejected.length) {
        onValidationError?.(
          rejected.map(({ file, message }) => `${file.name}: ${message}`)
        );
      }
      if (accepted.length) {
        onFiles(accepted);
      }
    },
    [onFiles, onValidationError]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = e.dataTransfer?.files;
      if (files && files.length) processFiles(Array.from(files));
    },
    [processFiles, disabled]
  );

  const handleDragOver = useCallback(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const handleDragEnter = useCallback(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }, []);

  const openPicker = () => inputRef.current?.click();

  const handlePicked = (e) => {
    const files = e.target.files;
    if (files && files.length) processFiles(Array.from(files));
    e.target.value = '';
  };

  return (
    <div
      className="relative h-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handlePicked}
        disabled={disabled}
      />
      {children({ openPicker })}

      {dragging && !disabled && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-50/90 backdrop-blur-sm dark:border-brand-500 dark:bg-brand-900/40">
          <div className="flex flex-col items-center gap-2 text-brand-700 dark:text-brand-300">
            <UploadCloudIcon className="text-4xl" />
            <p className="text-lg font-semibold">Drop files to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
