import { createContext, useContext, useState, ReactNode } from 'react';
import { ViewMode, StagedItems } from '@/types/metrics';

interface MetricsContextType {
    stagedItems: StagedItems;
    setStagedItems: (items: StagedItems) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    selectedCriteria: string[];
    setSelectedCriteria: (criteria: string[]) => void;
}

const MetricsContext = createContext<MetricsContextType | undefined>(undefined);

export function MetricsProvider({ children }: { children: ReactNode }) {
    const [stagedItems, setStagedItems] = useState<StagedItems>({
        runs: new Set(),
        sessions: new Set()
    });
    const [viewMode, setViewMode] = useState<ViewMode>('runs');
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);

    return (
        <MetricsContext.Provider value={{
            stagedItems,
            setStagedItems,
            viewMode,
            setViewMode,
            selectedCriteria,
            setSelectedCriteria
        }}>
            {children}
        </MetricsContext.Provider>
    );
}

export function useMetrics() {
    const context = useContext(MetricsContext);
    if (context === undefined) {
        throw new Error('useMetrics must be used within a MetricsProvider');
    }
    return context;
} 