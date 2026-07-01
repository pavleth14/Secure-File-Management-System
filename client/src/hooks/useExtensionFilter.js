import { useEffect, useMemo, useState } from 'react';
import {
  collectExtensionOptions,
  filterFilesByExtension,
} from '../utils/extensionFilter';

/**
 * Client-side extension filter for file lists (sort/search stay on the server).
 * @param {Array} files - Full file list for the current folder view
 * @param {string} resetKey - Change to reset filter (e.g. folder id + subfolder id)
 */
export function useExtensionFilter(files, resetKey) {
  const [extensionFilter, setExtensionFilter] = useState('all');

  useEffect(() => {
    setExtensionFilter('all');
  }, [resetKey]);

  const extensionOptions = useMemo(() => collectExtensionOptions(files), [files]);

  useEffect(() => {
    if (extensionFilter !== 'all' && !extensionOptions.includes(extensionFilter)) {
      setExtensionFilter('all');
    }
  }, [extensionFilter, extensionOptions]);

  const filteredFiles = useMemo(
    () => filterFilesByExtension(files, extensionFilter),
    [files, extensionFilter]
  );

  return {
    extensionFilter,
    setExtensionFilter,
    extensionOptions,
    filteredFiles,
  };
}
