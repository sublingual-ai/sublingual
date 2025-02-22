import { useMemo, useState } from "react";
import { LLMRun } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Minus, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface MetricsViewProps {
    runs: LLMRun[];
}


interface Evaluation {
    criteria: string;
    rating: number;
}

const CRITERIA_LABELS: Record<string, string> = {
    correctness: "Correctness",
    system_prompt_obedience: "System Prompt Obedience",
    user_sentiment: "User Sentiment"
};

export function MetricsView({ runs }: MetricsViewProps) {
    const [expandedRuns, setExpandedRuns] = useState<string[]>([]);
    const [selectedCriteria, setSelectedCriteria] = useState<EvaluationCriteria[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});

    const toggleRun = (runId: string) => {
        setExpandedRuns(prev =>
            prev.includes(runId)
                ? prev.filter(id => id !== runId)
                : [...prev, runId]
        );
    };

    const handleCriteriaChange = (value: EvaluationCriteria) => {
        setSelectedCriteria(prev => {
            if (prev.includes(value)) {
                return prev.filter(c => c !== value);
            }
            return [...prev, value];
        });
    };

    const handleRatingChange = (runId: string, criteria: EvaluationCriteria, rating: number) => {
        setEvaluations(prev => {
            const runEvaluations = prev[runId] || [];
            const updatedEvaluations = runEvaluations.filter(e => e.criteria !== criteria);
            return {
                ...prev,
                [runId]: [...updatedEvaluations, { criteria, rating }]
            };
        });
    };

    const handleAutoEvaluate = async (runId: string, run: LLMRun) => {
        try {
            const response = await fetch('http://localhost:5360/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    run_id: runId,
                    run: run,
                    criteria: selectedCriteria
                })
            });

            if (!response.ok) {
                throw new Error('Evaluation request failed');
            }

            const data = await response.json();

            // Update evaluations with received scores
            setEvaluations(prev => ({
                ...prev,
                [runId]: selectedCriteria.map(criteria => ({
                    criteria,
                    rating: data.scores[criteria]
                }))
            }));
        } catch (error) {
            console.error('Evaluation failed:', error);
            // You might want to add error handling UI here
        }
    };

    const AutoEvaluateButton = ({ runId, run }: { runId: string, run: LLMRun }) => (
        <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={(e) => {
                e.stopPropagation();
                handleAutoEvaluate(runId, run);
            }}
        >
            <Calculator className="w-4 h-4" />
            <span className="text-xs">Evaluate Metrics</span>
        </Button>
    );

    const NumericRating = ({ value, onChange }: { value: number; onChange: (rating: number) => void }) => {
        return (
            <div className="flex space-x-2">
                {value === 0 ? (
                    <Minus className="w-4 h-4 text-gray-300" />
                ) : (
                    <span className="font-medium text-primary-600">{value}/10</span>
                )}
                <select
                    className="opacity-0 absolute"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                >
                    <option value="0">-</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num}</option>
                    ))}
                </select>
            </div>
        );
    };

    const ScoreDisplay = ({ evaluations }: { evaluations: Evaluation[] }) => {
        return (
            <div className="flex gap-2">
                {selectedCriteria.map((criteria) => {
                    const score = evaluations.find(e => e.criteria === criteria)?.rating || 0;
                    return (
                        <Badge
                            key={criteria}
                            variant="outline"
                            className={`text-xs ${score > 0 ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`}
                        >
                            {CRITERIA_LABELS[criteria]}: {score > 0 ? score : '-'}
                        </Badge>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">LLM Runs</h2>
                <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Evaluation Criteria
                    </label>
                    <div className="flex gap-2">
                        {(Object.keys(CRITERIA_LABELS) as EvaluationCriteria[]).map((criteria) => (
                            <Badge
                                key={criteria}
                                variant={selectedCriteria.includes(criteria) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => handleCriteriaChange(criteria)}
                            >
                                {CRITERIA_LABELS[criteria]}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="divide-y divide-gray-100">
                    {runs.map((run, index) => {
                        const runId = `run-${index}`;
                        const isExpanded = expandedRuns.includes(runId);
                        const runEvaluations = evaluations[runId] || [];

                        return (
                            <div key={runId} className="transition-colors">
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => toggleRun(runId)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                                )}
                                                <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                                                    {run.stack_info?.caller_function_name || 'Unknown Caller'}
                                                </h3>
                                            </div>
                                            <div className="flex items-center space-x-2 mt-1">
                                                {run.stack_info && (
                                                    <Badge variant="outline" className="text-xs text-primary-700">
                                                        {run.stack_info.filename}:{run.stack_info.lineno}
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs text-primary-700">
                                                    {run.response.model}
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
                                                    {run.response.usage.total_tokens} tokens
                                                </Badge>
                                            </div>
                                            <div className="flex items-center space-x-4 mt-2">
                                                {selectedCriteria.length > 0 && (
                                                    <>
                                                        <ScoreDisplay evaluations={runEvaluations} />
                                                        <AutoEvaluateButton runId={runId} run={run} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {new Date(run.timestamp * 1000).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4">
                                        {selectedCriteria.length > 0 && (
                                            <div className="mb-4 space-y-3 border-b border-gray-100 pb-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-medium text-gray-900">Evaluation</h4>
                                                    <AutoEvaluateButton runId={runId} run={run} />
                                                </div>
                                                {selectedCriteria.map((criteria) => (
                                                    <div key={criteria} className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-700">{CRITERIA_LABELS[criteria]}</span>
                                                        <NumericRating
                                                            value={runEvaluations.find(e => e.criteria === criteria)?.rating || 0}
                                                            onChange={(rating) => handleRatingChange(runId, criteria, rating)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="space-y-3 text-sm">
                                            {run.messages.map((msg, msgIndex) => (
                                                <div key={msgIndex}>
                                                    <div className="font-medium text-gray-700">{msg.role}:</div>
                                                    <div className="mt-1 text-gray-600 bg-gray-100 p-3 rounded-md">
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            ))}
                                            <div>
                                                <div className="font-medium text-gray-700">Response:</div>
                                                {run.response_texts.map((text, respIndex) => (
                                                    <div key={respIndex} className="mt-1 text-gray-600 bg-gray-100 p-3 rounded-md">
                                                        <span className="font-mono text-xs text-gray-500 mr-2">[{respIndex}]</span>
                                                        {text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
} 