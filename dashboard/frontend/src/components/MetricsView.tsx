import { useMemo, useState } from "react";
import { LLMRun } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Minus, Calculator, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LLMInteraction } from "@/components/LLMInteraction";

interface MetricsViewProps {
    runs: LLMRun[];
}

type EvaluationCriteria = string;

type EvaluationStatus = 'unevaluated' | 'evaluated' | 'evaluation_failed';

interface Evaluation {
    criteria: EvaluationCriteria;
    rating: number;
    status: EvaluationStatus;
}

const CRITERIA_LABELS: Record<EvaluationCriteria, string> = {
    correctness: "Correctness",
    system_prompt_obedience: "System Prompt Obedience",
    user_sentiment: "User Sentiment"
};

interface LoadingState {
    [runId: string]: Set<string>; // Set of criteria currently loading
}

const MetricsSummary = ({
    runs,
    evaluations,
    selectedCriteria
}: {
    runs: LLMRun[];
    evaluations: Record<string, Evaluation[]>;
    selectedCriteria: EvaluationCriteria[];
}) => {
    const metrics = useMemo(() => {
        return selectedCriteria.map(criteria => {
            const allScores = Object.values(evaluations)
                .flatMap(evals => evals.filter(e => e.criteria === criteria && e.status === 'evaluated'))
                .map(e => parseFloat(e.rating.toString()));

            const totalRuns = runs.length;
            const gradedRuns = allScores.length;
            const sum = allScores.reduce((sum, score) => sum + score, 0);
            const averageScore = gradedRuns > 0 ? sum / gradedRuns : 0;

            return {
                criteria,
                averageScore: Math.round(averageScore),
                gradedRuns,
                totalRuns,
                completionRate: Math.round((gradedRuns / totalRuns) * 100)
            };
        });
    }, [runs, evaluations, selectedCriteria]);

    if (selectedCriteria.length === 0) return null;

    return (
        <div className="grid grid-cols-1 gap-3 mt-4">
            {metrics.map(metric => (
                <div key={metric.criteria} className="flex items-center gap-4">
                    <div className="w-40 text-sm text-gray-600">
                        {CRITERIA_LABELS[metric.criteria]}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-primary-600 font-medium">
                                {metric.averageScore}%
                            </span>
                            <span className="text-gray-500">
                                {metric.gradedRuns}/{metric.totalRuns} graded
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <Progress
                                value={metric.averageScore}
                                className="flex-1"
                            />
                            <Progress
                                value={metric.completionRate}
                                className="w-20 [&>div]:bg-gray-300 bg-gray-100"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export function MetricsView({ runs }: MetricsViewProps) {
    const [expandedRuns, setExpandedRuns] = useState<string[]>([]);
    const [selectedCriteria, setSelectedCriteria] = useState<EvaluationCriteria[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
    const [loadingStates, setLoadingStates] = useState<LoadingState>({});

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
                [runId]: [...updatedEvaluations, { criteria, rating, status: 'unevaluated' }]
            };
        });
    };

    const handleAutoEvaluate = async (runId: string, run: LLMRun) => {
        try {
            const existingEvals = evaluations[runId] || [];

            const criteriaToEvaluate = selectedCriteria.filter(criteria =>
                !existingEvals.some(evaluation =>
                    evaluation.criteria === criteria && evaluation.status === 'evaluated'
                )
            );

            if (criteriaToEvaluate.length === 0) return;

            setLoadingStates(prev => ({
                ...prev,
                [runId]: new Set(criteriaToEvaluate)
            }));

            const response = await fetch('http://localhost:5360/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    run_id: runId,
                    run: run,
                    criteria: criteriaToEvaluate
                })
            });

            if (!response.ok) {
                throw new Error('Evaluation request failed');
            }

            const data = await response.json();

            setEvaluations(prev => {
                const currentEvals = prev[runId] || [];
                const newEvals = criteriaToEvaluate.map(criteria => {
                    const score = data.scores[criteria];
                    return {
                        criteria,
                        rating: score === "<NO_SCORE>" ? 0 : parseInt(score, 10),
                        status: (score === "<NO_SCORE>" ? 'evaluation_failed' : 'evaluated') as EvaluationStatus
                    };
                });

                return {
                    ...prev,
                    [runId]: [...currentEvals, ...newEvals]
                };
            });
        } catch (error) {
            console.error('Evaluation failed:', error);
            setEvaluations(prev => {
                const currentEvals = prev[runId] || [];
                const failedEvals = selectedCriteria.filter(criteria =>
                    !currentEvals.some(evaluation =>
                        evaluation.criteria === criteria && evaluation.status === 'evaluated'
                    )
                ).map(criteria => ({
                    criteria,
                    rating: 0,
                    status: 'evaluation_failed' as EvaluationStatus
                }));

                return {
                    ...prev,
                    [runId]: [...currentEvals, ...failedEvals]
                };
            });
        } finally {
            setLoadingStates(prev => {
                const newState = { ...prev };
                delete newState[runId];
                return newState;
            });
        }
    };

    const handleEvaluateAll = async () => {
        // Get all runs that have unevaluated criteria
        const runsToEvaluate = runs.map((run, index) => {
            const runId = `run-${index}`;
            const existingEvals = evaluations[runId] || [];
            const criteriaToEvaluate = selectedCriteria.filter(criteria =>
                !existingEvals.some(evaluation =>
                    evaluation.criteria === criteria && evaluation.status === 'evaluated'
                )
            );
            return { run, runId, criteriaToEvaluate };
        }).filter(item => item.criteriaToEvaluate.length > 0);

        // If nothing to evaluate, return early
        if (runsToEvaluate.length === 0) return;

        // Evaluate each run
        for (const { run, runId, criteriaToEvaluate } of runsToEvaluate) {
            await handleAutoEvaluate(runId, run);
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

    const NumericRating = ({ value, onChange, isLoading }: {
        value: number;
        onChange: (rating: number) => void;
        isLoading?: boolean;
    }) => {
        if (isLoading) {
            return <Loader2 className="w-4 h-4 animate-spin text-primary-600" />;
        }

        return (
            <div className="flex space-x-2">
                {value === 0 ? (
                    <Minus className="w-4 h-4 text-gray-300" />
                ) : (
                    <span className="font-medium text-primary-600">{value}%</span>
                )}
                <select
                    className="opacity-0 absolute"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                >
                    <option value="0">-</option>
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => (
                        <option key={num} value={num}>{num}</option>
                    ))}
                </select>
            </div>
        );
    };

    const ScoreDisplay = ({ evaluations, runId }: { evaluations: Evaluation[], runId: string }) => {
        const isLoading = (criteria: string) =>
            loadingStates[runId]?.has(criteria) ?? false;

        return (
            <div className="flex gap-2">
                {selectedCriteria.map((criteria) => {
                    const evaluation = evaluations.find(e => e.criteria === criteria);
                    const displayValue = () => {
                        if (isLoading(criteria)) {
                            return <Loader2 className="w-3 h-3 animate-spin inline ml-1" />;
                        }
                        if (!evaluation || evaluation.status === 'unevaluated') {
                            return '-';
                        }
                        if (evaluation.status === 'evaluation_failed') {
                            return 'Failed';
                        }
                        return `${evaluation.rating}%`;
                    };

                    return (
                        <Badge
                            key={criteria}
                            variant="outline"
                            className={`text-xs ${evaluation?.status === 'evaluated' ? 'bg-primary-50 text-primary-700' :
                                evaluation?.status === 'evaluation_failed' ? 'bg-red-50 text-red-700' :
                                    'text-gray-500'
                                }`}
                        >
                            {CRITERIA_LABELS[criteria]}: {displayValue()}
                        </Badge>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="border-b border-gray-200">
                <div className="p-4">
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

                {selectedCriteria.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700">Metrics Summary</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={handleEvaluateAll}
                            >
                                <Calculator className="w-4 h-4" />
                                <span className="text-xs">Evaluate All</span>
                            </Button>
                        </div>
                        <MetricsSummary
                            runs={runs}
                            evaluations={evaluations}
                            selectedCriteria={selectedCriteria}
                        />
                    </div>
                )}
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
                                            {selectedCriteria.length > 0 && (
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <ScoreDisplay evaluations={runEvaluations} runId={runId} />
                                                    <AutoEvaluateButton runId={runId} run={run} />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {new Date(run.timestamp * 1000).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4">
                                        <LLMInteraction run={run} showHeader={false} />
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