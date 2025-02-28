import { LLMRun, Message } from "./logs";
import { Filter } from "@/types/logs";

export type EvaluationCriteria = string;

export type EvaluationStatus = 'unevaluated' | 'evaluated' | 'evaluation_failed';

export interface Evaluation {
    criteria: EvaluationCriteria;
    rating: number | boolean;
    status: EvaluationStatus;
}

export interface Metric {
    name: string;
    prompt: string;
    tool_type: string;
    min_val: number;
    max_val: number;
}

export interface Metrics {
    [key: string]: Metric;
}

export interface LoadingState {
    [runId: string]: Set<string>; // Set of criteria currently loading
}

export interface EvaluationResponse {
    scores: Record<string, any>;
    existing_evaluations?: Record<string, string[]>;
}

export interface SessionRow {
    sessionId: string;
    runs: LLMRun[];
    firstCall: number;
    lastCall: number;
    callCount: number;
    totalTokens: number;
}

export interface SpreadsheetColumn {
    id: string;
    name: string;
    width: number;
    getValue: (item: any) => string | number;
    align?: 'left' | 'center' | 'right';
    renderCell?: (item: any) => React.ReactNode;
}

export interface SpreadsheetProps {
    columns: SpreadsheetColumn[];
    data: any[];
    onRowClick: (item: any) => void;
    selectedItem: any | null;
    onColumnResize: (columnId: string, newWidth: number) => void;
    onFilter?: (filter: {
        field: string;
        value: any[];
        operator: 'in' | 'clear';
        runIds: string[];
    }) => void;
    isItemStaged: (item: any) => boolean;
} 