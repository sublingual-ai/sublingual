import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/config';

interface LogFileInfo {
  path: string;
}

interface LogFileContextType {
  selectedFiles: string[];
  availableFiles: LogFileInfo[];
  toggleFile: (file: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  logDirectoryError: string | null;
  refreshFiles: () => void;
}

const LogFileContext = createContext<LogFileContextType>({
  selectedFiles: [],
  availableFiles: [],
  toggleFile: () => {},
  selectAllFiles: () => {},
  deselectAllFiles: () => {},
  logDirectoryError: null,
  refreshFiles: () => {},
});

export const LogFileProvider = ({ children }: { children: React.ReactNode }) => {
  const [availableFiles, setAvailableFiles] = useState<LogFileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [logDirectoryError, setLogDirectoryError] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    console.log("Fetching available logs");
    try {
      const res = await fetch(`${API_BASE_URL}/get_available_logs`);
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 404 && data.error === 'log_dir') {
          throw new Error('Log directory not found. Please configure the log directory path.');
        }
        throw new Error('Failed to fetch log files');
      }
      const files = await res.json();
      const filesWithCounts = files.map((file: string) => ({
        path: file,
      }));
      setAvailableFiles(filesWithCounts);
      if (filesWithCounts.length > 0) {
        setSelectedFiles([filesWithCounts[0].path]);
      }
      setLogDirectoryError(null);
    } catch (err) {
      console.error('Error loading log files:', err);
      setLogDirectoryError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const toggleFile = (file: string) => {
    setSelectedFiles(prev => 
      prev.includes(file) 
        ? prev.filter(f => f !== file)
        : [...prev, file]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles([...availableFiles.map(f => f.path)]);
  };

  const deselectAllFiles = () => {
    setSelectedFiles([]);
  };

  return (
    <LogFileContext.Provider value={{
      selectedFiles,
      availableFiles,
      toggleFile,
      selectAllFiles,
      deselectAllFiles,
      logDirectoryError,
      refreshFiles,
    }}>
      {children}
    </LogFileContext.Provider>
  );
};

export const useLogFile = () => useContext(LogFileContext); 