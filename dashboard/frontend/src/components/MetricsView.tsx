import { useMemo, useState, useEffect } from "react";
import { LLMRun, Message } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Minus, Calculator, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
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
import { LLMHeader } from "@/components/LLMHeader";
import { API_BASE_URL } from '@/config';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Filter as FilterIcon, X } from "lucide-react";
import { Filter, FilterOption } from "@/types/logs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createHash } from 'crypto';

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

const getPreviewText = (messages: Message[], response: string) => {
    if (messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1].content;
    const preview = `${lastMessage} → ${response}`;
    return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
};

// Replace the existing getRunId function with this one
const getRunId = (run: LLMRun) => {
    // Create a string that includes all relevant unique properties
    const uniqueString = JSON.stringify({
        timestamp: run.timestamp,
        model: run.response.model,
        messages: run.messages,
        stack_info: run.stack_info,
        session_id: run.session_id,
        response: run.response
    });

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < uniqueString.length; i++) {
        const char = uniqueString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Return a string representation of the hash
    return `run-${Math.abs(hash)}`;
};

const MetricsSummary = ({
    filteredRuns,
    evaluations,
    selectedCriteria
}: {
    filteredRuns: LLMRun[];
    evaluations: Record<string, Evaluation[]>;
    selectedCriteria: EvaluationCriteria[];
}) => {
    const metrics = useMemo(() => {
        return selectedCriteria.map(criteria => {
            // Only include evaluations for filtered runs
            const filteredRunIds = new Set(filteredRuns.map(getRunId));
            const allScores = Object.entries(evaluations)
                .filter(([runId]) => filteredRunIds.has(runId))
                .flatMap(([_, evals]) => 
                    evals.filter(e => e.criteria === criteria && e.status === 'evaluated')
                )
                .map(e => parseFloat(e.rating.toString()));

            const totalRuns = filteredRuns.length;
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
    }, [filteredRuns, evaluations, selectedCriteria]);

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

const FilterSelector = ({ 
    filterOptions, 
    filters, 
    addFilter 
}: { 
    filterOptions: FilterOption[];
    filters: Filter[];
    addFilter: (field: string, value: any) => void;
}) => {
    const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedOption = filterOptions.find(opt => opt.field === selectedCriteria);
    
    const filteredValues = selectedOption?.values.filter(value => 
        String(value).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (selectedOption.field === 'output_tokens' && 
         `${value}-${value + 100} tokens`.toLowerCase().includes(searchQuery.toLowerCase()))
    ) ?? [];

    // Add this helper function to handle multiple selections
    const handleSelectionChange = (field: string, value: any) => {
        const existingFilter = filters.find(f => f.field === field);
        const values = existingFilter?.value || [];
        
        if (values.includes(value)) {
            // If value exists, remove it
            if (values.length === 1) {
                // If it's the last value, remove the whole filter
                addFilter(field, []);
            } else {
                // Otherwise, remove just this value
                addFilter(field, values.filter(v => v !== value));
            }
        } else {
            // If value doesn't exist, add it to existing values
            addFilter(field, [...values, value]);
        }
    };

    return (
        <div className="space-y-4">
            {!selectedCriteria ? (
                // Show criteria selection when no criteria is selected
                <>
                    <div className="text-sm font-medium mb-2">Select criteria to filter by:</div>
                    <div className="space-y-2">
                        {filterOptions.map(option => {
                            const activeFilter = filters.find(f => f.field === option.field);
                            const selectedCount = activeFilter?.value?.length || 0;
                            
                            return (
                                <div
                                    key={option.field}
                                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                                    onClick={() => setSelectedCriteria(option.field)}
                                >
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{option.label}</div>
                                        <div className="text-xs text-gray-500">
                                            {selectedCount > 0 ? `${selectedCount} selected` : 'No filters'}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                // Show value selection when criteria is selected
                <>
                    <div className="flex items-center space-x-2">
                        <button
                            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
                            onClick={() => {
                                setSelectedCriteria(null);
                                setSearchQuery("");
                            }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                        <div className="text-sm font-medium">{selectedOption?.label}</div>
                    </div>
                    
                    <Input
                        placeholder="Search values..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mb-2"
                    />
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredValues.map(value => {
                            const filter = filters.find(f => f.field === selectedCriteria);
                            const isChecked = filter?.value?.includes(value) ?? false;
                            const label = selectedOption?.field === 'output_tokens' 
                                ? `${value}-${value + 100} tokens`
                                : String(value);
                            
                            return (
                                <div key={value} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`${selectedCriteria}-${value}`}
                                        checked={isChecked}
                                        onCheckedChange={() => handleSelectionChange(selectedCriteria, value)}
                                    />
                                    <label 
                                        htmlFor={`${selectedCriteria}-${value}`}
                                        className="text-sm cursor-pointer"
                                    >
                                        {label}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export function MetricsView({ runs }: MetricsViewProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [expandedRuns, setExpandedRuns] = useState<string[]>([]);
    const [selectedCriteria, setSelectedCriteria] = useState<EvaluationCriteria[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
    const [loadingStates, setLoadingStates] = useState<LoadingState>({});
    const [filters, setFilters] = useState<Filter[]>([]);

    // Get filtered runs based on filters
    const filteredRuns = useMemo(() => {
        return runs.filter(run => {
            return filters.every(filter => {
                const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                switch (filter.field) {
                    case 'model':
                        return values.includes(run.response.model);
                    case 'temperature':
                        return values.includes(run.call_parameters.temperature);
                    case 'filename':
                        return values.includes(run.stack_info?.filename);
                    case 'output_tokens':
                        const tokenRange = Math.floor(run.usage.total_tokens / 100) * 100;
                        return values.includes(tokenRange);
                    default:
                        return true;
                }
            });
        });
    }, [runs, filters]);

    // Clean up evaluations when filters or runs change
    useEffect(() => {
        setEvaluations(prev => {
            const newEvals: Record<string, Evaluation[]> = {};
            filteredRuns.forEach(run => {
                const runId = getRunId(run);
                if (prev[runId]) {
                    newEvals[runId] = prev[runId];
                }
            });
            return newEvals;
        });
    }, [filteredRuns]);

    // Reset states when runs change
    useEffect(() => {
        setIsLoading(true);
        setExpandedRuns([]);
        setSelectedCriteria([]);
        setEvaluations({});
        setLoadingStates({});
        setFilters([]);
        setTimeout(() => setIsLoading(false), 100);
    }, [runs]);

    const handleAutoEvaluate = async (run: LLMRun) => {
        const runId = getRunId(run);
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

            const response = await fetch(`${API_BASE_URL}/evaluate`, {
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
        // Get all filtered runs that have unevaluated criteria
        const runsToEvaluate = filteredRuns.map(run => {
            const runId = getRunId(run);
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

        // Evaluate each filtered run
        for (const { run } of runsToEvaluate) {
            await handleAutoEvaluate(run);
        }
    };

    const toggleRun = (run: LLMRun) => {
        const runId = getRunId(run);
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

    const AutoEvaluateButton = ({ runId, run }: { runId: string, run: LLMRun }) => (
        <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={(e) => {
                e.stopPropagation();
                handleAutoEvaluate(run);
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

    const getFilterOptions = useMemo((): FilterOption[] => {
        const options: FilterOption[] = [
            {
                field: 'model',
                label: 'Model',
                values: Array.from(new Set(runs.map(run => run.response.model))),
                type: 'multiselect'
            },
            {
                field: 'temperature',
                label: 'Temperature',
                values: Array.from(new Set(runs.map(run => run.call_parameters.temperature))),
                type: 'multiselect'
            },
            {
                field: 'filename',
                label: 'File Name',
                values: Array.from(new Set(runs.map(run => run.stack_info?.filename).filter(Boolean))),
                type: 'multiselect'
            },
            {
                field: 'output_tokens',
                label: 'Output Tokens',
                values: Array.from(new Set(runs.map(run => {
                    const tokens = run.usage.total_tokens;
                    // Create ranges: 0-100, 100-200, etc.
                    return Math.floor(tokens / 100) * 100;
                }))).sort((a, b) => a - b),
                type: 'multiselect'
            }
        ];
        return options;
    }, [runs]);

    const addFilter = (field: string, values: any[]) => {
        setFilters(prev => {
            if (values.length === 0) {
                // Remove the filter if no values are selected
                return prev.filter(f => f.field !== field);
            }
            
            const existingFilter = prev.find(f => f.field === field);
            if (existingFilter) {
                // Update existing filter with new values
                return prev.map(f => {
                    if (f.field === field) {
                        return { ...f, value: values };
                    }
                    return f;
                });
            }
            
            // Add new filter
            return [...prev, { field, value: values }];
        });
    };

    const removeFilter = (index: number) => {
        setFilters(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            ) : (
                <>
                    {/* Evaluation Controls Box */}
                    <div className="flex-none">
                        {selectedCriteria.length > 0 ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                                <div className="p-4">
                                    <div>
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

                                    <div className="mt-4">
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
                                            filteredRuns={filteredRuns}
                                            evaluations={evaluations}
                                            selectedCriteria={selectedCriteria}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
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
                        )}
                    </div>

                    {/* Main Runs List Box */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
                        <div className="border-b border-gray-200 p-4 flex-none">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">LLM Runs</h2>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                                            <FilterIcon className="w-4 h-4" />
                                            Add Filter
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                        <FilterSelector 
                                            filterOptions={getFilterOptions} 
                                            filters={filters} 
                                            addFilter={addFilter}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {filters.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {filters.map((filter, index) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="flex items-center gap-1"
                                        >
                                            {getFilterOptions.find(opt => opt.field === filter.field)?.label}:
                                            {Array.isArray(filter.value) && filter.value.map((v, i) => (
                                                <span key={i}>
                                                    {filter.field === 'output_tokens' ? `${v}-${v + 100}` : v}
                                                    {i < filter.value.length - 1 ? ', ' : ''}
                                                </span>
                                            ))}
                                            <button
                                                onClick={() => removeFilter(index)}
                                                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="divide-y divide-gray-100">
                                {filteredRuns.map((run, index) => {
                                    const runId = getRunId(run);
                                    const isExpanded = expandedRuns.includes(runId);
                                    const runEvaluations = evaluations[runId] || [];

                                    return (
                                        <div key={runId} className="transition-colors">
                                            <div
                                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => toggleRun(run)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2">
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-4 h-4 text-gray-500" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-gray-500" />
                                                            )}
                                                            <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                                                                {getPreviewText(run.messages, run.response_texts[0])}
                                                            </h3>
                                                        </div>
                                                        <LLMHeader run={run} />
                                                        <div className="flex items-center space-x-2 mt-1">
                                                            {run.stack_info && (
                                                                <Badge variant="outline" className="text-xs text-primary-700">
                                                                    {run.stack_info.filename}:{run.stack_info.lineno}
                                                                </Badge>
                                                            )}
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
                                                    <div className="space-y-2">
                                                        <LLMInteraction run={run} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </>
            )}
        </div>
    );
} 