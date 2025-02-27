import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config';

interface LogFileInfo {
  path: string;
}

export type LogFileContextType = {
  selectedFiles: string[];
  availableFiles: LogFileInfo[];
  toggleFile: (file: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  refreshFiles: () => Promise<void>;
};

const LogFileContext = createContext<LogFileContextType>({
  selectedFiles: [],
  availableFiles: [],
  toggleFile: () => {},
  selectAllFiles: () => {},
  deselectAllFiles: () => {},
  refreshFiles: async () => {},
});

export const LogFileProvider = ({ children }: { children: React.ReactNode }) => {
  const [availableFiles, setAvailableFiles] = useState<LogFileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/get_available_logs`)
      .then(res => res.json())
      .then(async (files) => {
        const filesWithCounts = await Promise.all(files.map(async (file) => {
          return {
            path: file,
          };
        }));
        setAvailableFiles(filesWithCounts);
        if (filesWithCounts.length > 0) {
          setSelectedFiles([filesWithCounts[0].path]);
        }
      })
      .catch(err => console.error('Error loading log files:', err));
  }, []);

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

  const refreshFiles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get_available_logs`);
      if (response.ok) {
        const files = await response.json();
        const filesWithCounts = await Promise.all(files.map(async (file) => {
          return {
            path: file,
          };
        }));
        setAvailableFiles(filesWithCounts);
      }
    } catch (error) {
      console.error('Failed to refresh files:', error);
    }
  };

  return (
    <LogFileContext.Provider value={{
      selectedFiles,
      availableFiles,
      toggleFile,
      selectAllFiles,
      deselectAllFiles,
      refreshFiles,
    }}>
      {children}
    </LogFileContext.Provider>
  );
};

export const useLogFile = () => useContext(LogFileContext); 