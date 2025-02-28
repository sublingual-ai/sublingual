import { LLMRun } from "@/types/logs";
import { Evaluation, Metrics } from "@/types/metrics";
import { X, Calculator, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LLMHeader } from "@/components/LLMHeader";
import { LLMInteraction } from "@/components/LLMInteraction";
import { formatTimestamp } from "@/utils/metrics";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useState } from "react";

interface SidePaneProps {
    run: LLMRun;
    onClose: () => void;
    evaluations: Evaluation[];
    selectedCriteria: string[];
    metrics: Metrics;
    onAutoEvaluate: () => void;
    sessionRuns?: LLMRun[];
}

export function SidePane({
    run,
    onClose,
    evaluations,
    selectedCriteria,
    metrics,
    onAutoEvaluate,
    sessionRuns
}: SidePaneProps) {
    const [isEvaluating, setIsEvaluating] = useState(false);
    
    const handleEvaluate = async () => {
        setIsEvaluating(true);
        try {
            await onAutoEvaluate();
        } finally {
            // Add a small delay to make the loading state visible even for quick evaluations
            setTimeout(() => {
                setIsEvaluating(false);
            }, 500);
        }
    };
    
    const content = (
        <div
            className="fixed inset-y-0 right-0 w-1/2 bg-white border-l border-gray-200 shadow-xl z-50
                transform transition-transform duration-200 ease-out"
        >
            <button
                onClick={onClose}
                className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
                           bg-white p-1.5 rounded-full border border-gray-200 shadow-md 
                           hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Collapse panel"
            >
                <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">Run Details</h2>
                        <div className="text-sm text-gray-500">
                            {formatTimestamp(run.timestamp)}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    <div className="p-4 space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-700">Basic Info</h3>
                            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                                <div className="text-sm">
                                    <LLMHeader run={run} />
                                </div>
                                {run.stack_info && (
                                    <Badge variant="outline" className="text-xs text-primary-700">
                                        {run.stack_info.filename}:{run.stack_info.lineno}
                                    </Badge>
                                )}
                                {run.response?.usage && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {run.response.usage.prompt_tokens != null && (
                                            <Badge variant="outline" className="text-xs text-primary-700">
                                                Input: {run.response.usage.prompt_tokens} tokens
                                            </Badge>
                                        )}
                                        {run.response.usage.completion_tokens != null && (
                                            <Badge variant="outline" className="text-xs text-primary-700">
                                                Output: {run.response.usage.completion_tokens} tokens
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-700">Evaluations</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                    onClick={handleEvaluate}
                                    disabled={selectedCriteria.length === 0 || isEvaluating}
                                >
                                    {isEvaluating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Calculator className="w-4 h-4" />
                                    )}
                                    <span className="text-xs">
                                        {isEvaluating ? "Evaluating..." : "Evaluate Metrics"}
                                    </span>
                                </Button>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                {selectedCriteria.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCriteria.map(criteria => {
                                            const metric = metrics[criteria];
                                            const evaluation = evaluations.find(e => e.criteria === criteria);

                                            // Determine if this metric has been evaluated
                                            const isEvaluated = evaluation && evaluation.status === 'evaluated';

                                            // Determine the display value
                                            const value = isEvaluated
                                                ? (metric.tool_type === 'bool'
                                                    ? (evaluation.rating ? 'Yes' : 'No')
                                                    : typeof evaluation.rating === 'number'
                                                        ? `${evaluation.rating}${metric.tool_type === 'int' ? '%' : ''}`
                                                        : evaluation.rating)
                                                : '-';

                                            return (
                                                <Badge
                                                    key={criteria}
                                                    variant="outline"
                                                    className={`${isEvaluated
                                                        ? 'bg-primary-50/50 border-primary-100 text-primary-700'
                                                        : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                                >
                                                    {metric.name}: {value}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-3">
                                        <p className="text-sm text-gray-500">
                                            Please select some metrics to evaluate first.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-700">Interaction</h3>
                            <LLMInteraction run={run} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <ErrorBoundary>
            {content}
        </ErrorBoundary>
    );
} 