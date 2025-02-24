import React, { createContext, useContext, useState } from 'react';

interface LogFileContextType {
  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;
}

const LogFileContext = createContext<LogFileContextType | undefined>(undefined);

export function LogFileProvider({ children }: { children: React.ReactNode }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <LogFileContext.Provider value={{ selectedFile, setSelectedFile }}>
      {children}
    </LogFileContext.Provider>
  );
}

export function useLogFile() {
  const context = useContext(LogFileContext);
  if (context === undefined) {
    throw new Error('useLogFile must be used within a LogFileProvider');
  }
  return context;
} 