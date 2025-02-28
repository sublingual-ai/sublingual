import { useMemo, useState, useEffect } from "react";
import { LLMRun, Message } from "@/types/logs";
import { ChevronDown, Calculator, Loader2, ChevronRight, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from '@/config';
import { Filter, FilterOption } from "@/types/logs";
import { RunsFilter } from "@/components/RunsFilter";
import { useToast } from "@/components/ui/use-toast";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SessionsList } from "@/components/SessionsList";
import { Checkbox } from "@/components/ui/checkbox";

import { MetricsSummary } from "./MetricsSummary";
import { AddMetricDialog } from "./AddMetricDialog";
import { SidePane } from "./SidePane";
import { Spreadsheet } from "./Spreadsheet";
import { getRunId, formatTimestamp, getPreviewText, groupRunsIntoSessions } from "@/utils/metrics";
import ErrorBoundary from "@/components/ErrorBoundary";

interface MetricsViewProps {
	runs: LLMRun[];
}

type EvaluationCriteria = string;

type EvaluationStatus = 'unevaluated' | 'evaluated' | 'evaluation_failed';

interface Evaluation {
	criteria: EvaluationCriteria;
	rating: number | boolean;
	status: EvaluationStatus;
}

interface Metric {
	name: string;
	prompt: string;
	tool_type: string;
	min_val: number;
	max_val: number;
}

interface Metrics {
	[key: string]: Metric;
}

interface LoadingState {
	[runId: string]: Set<string>; // Set of criteria currently loading
}

interface NewMetric {
	name: string;
	prompt: string;
	tool_type: string;
	min_val: number;
	max_val: number;
}

interface EvaluationResponse {
	scores: Record<string, any>;
	existing_evaluations?: Record<string, string[]>;
}

type ViewMode = 'runs' | 'sessions';

interface SpreadsheetColumn {
	id: string;
	name: string;
	width: number;
	getValue: (item: any) => string | number;
	align?: 'left' | 'center' | 'right';
	renderCell?: (item: any) => React.ReactNode;
}

interface SpreadsheetProps {
	columns: SpreadsheetColumn[];
	data: any[];
	onRowClick: (item: any) => void;
	selectedItem: any | null;
	onFilter?: (filter: Filter) => void;
	onColumnResize: (columnId: string, event: React.MouseEvent) => void;
	isItemStaged: (item: any) => boolean;
}

interface SessionRow {
	sessionId: string;
	runs: LLMRun[];
	firstCall: number;
	lastCall: number;
	callCount: number;
	totalTokens: number;
}

interface StagedItems {
	runs: Set<string>;  // Set of run IDs
	sessions: Set<string>;  // Set of session IDs
}

export function MetricsView({ runs }: MetricsViewProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
	const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
	const [loadingStates, setLoadingStates] = useState<LoadingState>({});
	const [filters, setFilters] = useState<Filter[]>([]);
	const [metrics, setMetrics] = useState<Metrics>({});
	const [selectedRun, setSelectedRun] = useState<LLMRun | null>(null);
	const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>('runs');
	const [columnWidths, setColumnWidths] = useState({
		timestamp: 160,
		message: 500,
		model: 120,
		temp: 80,
		metrics: {} as Record<string, number>
	});
	const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
	const [stagedItems, setStagedItems] = useState<StagedItems>({
		runs: new Set(),
		sessions: new Set()
	});

	const { toast } = useToast();

	// Fetch metrics on mount
	useEffect(() => {
		const fetchMetrics = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/metrics`);
				if (!response.ok) throw new Error('Failed to fetch metrics');
				const data = await response.json();
				setMetrics(data);
			} catch (error) {
				console.error('Error fetching metrics:', error);
				toast({
					variant: "destructive",
					title: "Error",
					description: "Failed to load evaluation metrics",
				});
			}
		};

		fetchMetrics();
	}, []);

	// Fetch existing evaluations on mount
	useEffect(() => {
		const fetchExistingEvaluations = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/evaluations`);
				if (!response.ok) throw new Error('Failed to fetch evaluations');
				const data = await response.json();

				const formattedEvals: Record<string, Evaluation[]> = {};
				Object.entries(data).forEach(([runId, runEvals]: [string, Record<string, any>]) => {
					formattedEvals[runId] = Object.entries(runEvals).map(([criteria, rating]) => ({
						criteria,
						rating,
						status: 'evaluated' as const
					}));
				});

				setEvaluations(formattedEvals);
			} catch (error) {
				console.error('Error fetching evaluations:', error);
				toast({
					variant: "destructive",
					title: "Error",
					description: "Failed to load existing evaluations",
				});
			}
		};

		fetchExistingEvaluations();
	}, []);

	// Update the filteredRuns useMemo to properly handle AND/OR logic
	const filteredRuns = useMemo(() => {
		if (filters.length === 0) return runs;

		// Group filters by field
		const filtersByField = filters.reduce((acc, filter) => {
			if (!acc[filter.field]) {
				acc[filter.field] = [];
			}
			acc[filter.field].push(filter);
			return acc;
		}, {} as Record<string, Filter[]>);

		// Apply filters to runs
		return runs.filter(run => {
			const runId = getRunId(run);

			// Each field's filters are combined with OR logic
			// All fields must match (AND logic between different fields)
			return Object.values(filtersByField).every(fieldFilters => {
				// If any filter in this field matches (OR logic), return true
				return fieldFilters.some(filter => {
					const runIds = filter.runIds || [];
					return runIds.includes(runId);
				});
			});
		});
	}, [runs, filters]);

	// Update evaluations when filtered runs change
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

	// Reset loading state when runs change
	useEffect(() => {
		setIsLoading(true);
		setSelectedCriteria([]);
		setFilters([]);
		setTimeout(() => setIsLoading(false), 100);
	}, [runs]);

	const handleCriteriaChange = (value: string) => {
		setSelectedCriteria(prev => {
			if (prev.includes(value)) {
				return prev.filter(c => c !== value);
			}
			return [...prev, value];
		});
	};

	const handleRatingChange = (runId: string, criteria: string, rating: number) => {
		setEvaluations(prev => {
			const runEvaluations = prev[runId] || [];
			const updatedEvaluations = runEvaluations.filter(e => e.criteria !== criteria);
			return {
				...prev,
				[runId]: [...updatedEvaluations, { criteria, rating, status: 'unevaluated' as const }]
			};
		});
	};

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
					const metric = metrics[criteria];
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
						if (metric.tool_type === 'bool') {
							return evaluation.rating === true ? 'Yes' : 'No';
						}
						return `${evaluation.rating}`;
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
							{metrics[criteria].name}: {displayValue()}
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
					criteria: criteriaToEvaluate,
					force: true
				})
			});

			if (!response.ok) {
				if (response.status === 503) {
					console.error("OpenAI Client Error");
					toast({
						variant: "destructive",
						title: "OpenAI Client Error",
						description: "OpenAI api access is required to use evals. Please be sure to include OPENAI_API_KEY=sk... in the .env file, and restart the dashboard. ",
					});
				}
				throw new Error('Evaluation request failed');
			}

			const data = await response.json();

			setEvaluations(prev => {
				const currentEvals = prev[runId] || [];
				const newEvals = criteriaToEvaluate.map(criteria => ({
					criteria,
					rating: data.scores[criteria] === "<NO_SCORE>" ? 0 :
						metrics[criteria].tool_type === 'bool' ? data.scores[criteria] === 'true' || data.scores[criteria] === true :
							parseInt(data.scores[criteria], 10),
					status: (data.scores[criteria] === "<NO_SCORE>" ? 'evaluation_failed' : 'evaluated') as EvaluationStatus
				}));

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

	const getItemId = (item: LLMRun | SessionRow): string => {
		if ('runs' in item) {
			return item.sessionId;
		}
		return getRunId(item);
	};

	const isItemStaged = (item: LLMRun | SessionRow): boolean => {
		const id = getItemId(item);
		return 'runs' in item 
			? stagedItems.sessions.has(id)
			: stagedItems.runs.has(id);
	};

	const toggleItemStaged = (item: LLMRun | SessionRow) => {
		const id = getItemId(item);
		setStagedItems(prev => {
			const newStaged = { ...prev };
			const targetSet = 'runs' in item ? 'sessions' : 'runs';
			
			if (isItemStaged(item)) {
				newStaged[targetSet].delete(id);
			} else {
				newStaged[targetSet].add(id);
			}
			
			return newStaged;
		});
	};

	const toggleAllStaged = () => {
		const currentData = viewMode === 'runs' ? filteredRuns : sessions;
		const allStaged = currentData.every(item => isItemStaged(item));
		
		setStagedItems(prev => {
			const newStaged = { ...prev };
			const targetSet = viewMode === 'runs' ? 'runs' : 'sessions';
			
			if (allStaged) {
				newStaged[targetSet].clear();
			} else {
				currentData.forEach(item => {
					newStaged[targetSet].add(getItemId(item));
				});
			}
			
			return newStaged;
		});
	};

	const handleEvaluateAll = async () => {
		const runsToEvaluate = filteredRuns.filter(run => {
			const runId = getRunId(run);
			const isStaged = stagedItems.runs.has(runId) || 
				stagedItems.sessions.has(sessions.find(s => s.runs.includes(run))?.sessionId || '');
			
			if (!isStaged) return false;

			const existingEvals = evaluations[runId] || [];
			return selectedCriteria.some(criteria =>
				!existingEvals.some(evaluation =>
					evaluation.criteria === criteria && evaluation.status === 'evaluated'
				)
			);
		});

		setIsEvaluatingAll(true);
		try {
			// Evaluate each filtered run
			for (const run of runsToEvaluate) {
				await handleAutoEvaluate(run);
			}
		} finally {
			// Add a small delay to ensure the loading state is visible
			setTimeout(() => {
				setIsEvaluatingAll(false);
			}, 500);
		}
	};

	const handleColumnResize = (columnId: string, newWidth: number) => {
		setColumnWidths(prev => {
			if (selectedCriteria.includes(columnId)) {
				return {
					...prev,
					metrics: {
						...prev.metrics,
						[columnId]: newWidth
					}
				};
			}
			return {
				...prev,
				[columnId]: newWidth
			};
		});
	};

	const runColumns: SpreadsheetColumn[] = [
		{
			id: 'timestamp',
			name: 'Timestamp',
			width: 160,
			getValue: (run: LLMRun) => formatTimestamp(run.timestamp)
		},
		{
			id: 'message',
			name: 'Message',
			width: 500,
			getValue: (run: LLMRun) => getPreviewText(run.messages, run.response_texts[0])
		},
		{
			id: 'model',
			name: 'Model',
			width: 120,
			getValue: (run: LLMRun) => run.response?.model || '-'
		},
		{
			id: 'temp',
			name: 'Temp',
			width: 80,
			getValue: (run: LLMRun) => run.call_parameters?.temperature?.toString() || '-'
		},
		{
			id: 'stack_trace',
			name: 'Stack Trace',
			width: 200,
			getValue: (run: LLMRun) => {
				if (!run.stack_trace) return '-';
				return run.stack_trace.map(frame => {
					const filename = frame.filename?.split('/').pop() || frame.filename || '';
					return `${filename}:${frame.lineno}`;
				}).join('::');
			}
		}
	];

	const sessionColumns: SpreadsheetColumn[] = [
		{
			id: 'timestamp',
			name: 'First Call',
			width: 160,
			getValue: (session: SessionRow) => formatTimestamp(session.firstCall)
		},
		{
			id: 'lastCall',
			name: 'Last Call',
			width: 160,
			getValue: (session: SessionRow) => formatTimestamp(session.lastCall)
		},
		{
			id: 'calls',
			name: 'Calls',
			width: 80,
			getValue: (session: SessionRow) => session.callCount?.toString() || '0',
			align: 'center'
		},
		{
			id: 'tokens',
			name: 'Tokens',
			width: 80,
			getValue: (session: SessionRow) => session.totalTokens?.toString() || '0',
			align: 'center'
		}
	];

	// Add session state
	const sessions = useMemo(() => groupRunsIntoSessions(filteredRuns), [filteredRuns]);

	// Update columns to include metrics
	const getMetricColumns = (): SpreadsheetColumn[] =>
		selectedCriteria.map(criteria => ({
			id: criteria,
			name: metrics[criteria].name,
			width: columnWidths.metrics[criteria] || 80,
			align: 'center' as const,
			getValue: (item: LLMRun | SessionRow) => {
				console.log('Getting metric value for:', {
					criteria,
					item,
					itemType: 'runs' in item ? 'SessionRow' : 'LLMRun'
				});

				if ('runs' in item) { // SessionRow
					const sessionEvals = item.runs.map(run => {
						const runId = getRunId(run);
						const evaluation = evaluations[runId]?.find(e => e.criteria === criteria);
						console.log('Session evaluation:', { runId, evaluation });
						return evaluation;
					}).filter(e => e?.status === 'evaluated');

					console.log('Session evaluations:', sessionEvals);

					if (sessionEvals.length === 0) return '-';

					// Average the ratings
					const avg = sessionEvals.reduce((sum, e) => sum + (typeof e?.rating === 'number' ? e.rating : 0), 0) / sessionEvals.length;
					return `${Math.round(avg)}%`;
				} else { // LLMRun
					const runId = getRunId(item);
					const evaluation = evaluations[runId]?.find(e => e.criteria === criteria);
					console.log('Run evaluation:', { runId, evaluation });

					if (!evaluation || evaluation.status !== 'evaluated') return '-';

					return metrics[criteria].tool_type === 'bool'
						? (evaluation.rating ? 'Yes' : 'No')
						: `${evaluation.rating}${metrics[criteria].tool_type === 'int' ? '%' : ''}`;
				}
			}
		}));

	const checkboxColumn: SpreadsheetColumn = {
		id: 'checkbox',
		name: 'Staged',
		width: 70,
		getValue: () => '',
		renderCell: (item: LLMRun | SessionRow) => (
			<div className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
				<Checkbox
					checked={isItemStaged(item)}
					onCheckedChange={() => toggleItemStaged(item)}
				/>
			</div>
		)
	};

	const currentColumns = useMemo(() => {
		const baseColumns = viewMode === 'runs' ? runColumns.map(col => ({
			...col,
			width: (columnWidths[col.id as keyof typeof columnWidths] as number) || col.width
		})) : sessionColumns;
		
		return [checkboxColumn, ...baseColumns, ...getMetricColumns()];
	}, [viewMode, selectedCriteria, metrics, columnWidths, runColumns, sessionColumns, stagedItems]);

	const handleRowClick = (item: LLMRun | SessionRow) => {
		if ('runs' in item) {
			setSelectedSession(item);
			setSelectedRun(null);
		} else {
			setSelectedRun(item);
			setSelectedSession(null);
		}
	};

	// Update the handleFilter function to store runIds in the filter
	const handleFilter = (filter: Filter) => {
		if (filter.operator === 'clear') {
			// Remove filter for this field
			setFilters(prev => prev.filter(f => f.field !== filter.field));
		} else if (filter.operator === 'in') {
			// Add or update filter with runIds
			setFilters(prev => {
				const existingFilterIndex = prev.findIndex(f => f.field === filter.field);
				if (existingFilterIndex >= 0) {
					const newFilters = [...prev];
					newFilters[existingFilterIndex] = filter;
					return newFilters;
				}
				return [...prev, filter];
			});
		}
	};

	const ActiveFilters = ({ filters, onRemove }: { filters: Filter[], onRemove: (field: string) => void }) => {
		if (filters.length === 0) return null;

		return (
			<div className="p-2 border-b border-gray-200">
				<div className="flex flex-wrap gap-2 items-center">
					<span className="text-xs font-medium text-gray-500">Active filters:</span>
					{filters.map((filter, index) => {
						const values = Array.isArray(filter.value) ? filter.value : [filter.value];
						return (
							<div
								key={index}
								className="flex items-center gap-1 bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-md"
							>
								<span className="font-medium">{filter.field}:</span>
								<span>{values.join(', ')}</span>
								<button
									onClick={() => onRemove(filter.field)}
									className="ml-1 p-0.5 rounded-full hover:bg-primary-100"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						);
					})}
					<button
						onClick={() => filters.forEach(f => onRemove(f.field))}
						className="text-xs text-gray-500 hover:text-gray-700 underline"
					>
						Clear all
					</button>
				</div>
			</div>
		);
	};

	const removeFilter = (field: string) => {
		setFilters(prev => prev.filter(f => f.field !== field));
	};

	const getTotalTokens = () => {
		const currentData = viewMode === 'runs' ? filteredRuns : sessions;
		const stagedData = currentData.filter(item => isItemStaged(item));
		
		return stagedData.reduce((total, item) => {
			if ('runs' in item) { // SessionRow
				return total + item.totalTokens;
			} else { // LLMRun
				return total + (item.usage?.total_tokens || 0);
			}
		}, 0);
	};

	return (
		<div className="space-y-4 h-full flex flex-col">
			<div className="flex-none">
				<div className="bg-white rounded-lg border border-gray-100 p-2">
					<div className="flex gap-2">
						<button
							className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'runs'
								? 'bg-primary-50 text-primary-900'
								: 'text-gray-600 hover:bg-gray-50'
								}`}
							onClick={() => setViewMode('runs')}
						>
							Run View
						</button>
						<button
							className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'sessions'
								? 'bg-primary-50 text-primary-900'
								: 'text-gray-600 hover:bg-gray-50'
								}`}
							onClick={() => setViewMode('sessions')}
						>
							Session View
						</button>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary-600" />
				</div>
			) : (
				<>
					{/* Evaluation Controls Box */}
					<div className="flex-none">
						{selectedCriteria.length > 0 ? (
							<div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in">
								<div className="p-4">
									<div className="flex justify-between items-center mb-2">
										<label className="text-sm font-medium text-gray-700">
											Select Evaluation Metrics
										</label>
										<ErrorBoundary>
											<AddMetricDialog onMetricAdded={() => {
												// Refresh metrics when a new one is added
												fetch(`${API_BASE_URL}/metrics`)
													.then(response => response.json())
													.then(data => setMetrics(data))
													.catch(error => {
														console.error('Error fetching metrics:', error);
														toast({
															variant: "destructive",
															title: "Error",
															description: "Failed to refresh metrics",
														});
													});
											}} />
										</ErrorBoundary>
									</div>
									<div className="flex gap-2">
										{Object.keys(metrics).map((criteria) => (
											<Badge
												key={criteria}
												variant={selectedCriteria.includes(criteria) ? "default" : "outline"}
												className="cursor-pointer"
												onClick={() => handleCriteriaChange(criteria)}
											>
												{metrics[criteria].name}
											</Badge>
										))}
									</div>

									<div className="mt-4">
										<div className="flex items-center justify-between mb-3">
											<h3 className="text-sm font-medium text-gray-700">Metrics Summary</h3>
											<Button
												variant="outline"
												size="sm"
												className="flex items-center gap-2"
												onClick={handleEvaluateAll}
												disabled={isEvaluatingAll || selectedCriteria.length === 0}
											>
												{isEvaluatingAll ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<Calculator className="w-4 h-4" />
												)}
												<span className="text-xs">
													{isEvaluatingAll ? "Evaluating..." : "Evaluate metrics on ALL entries"}
												</span>
											</Button>
										</div>
										<ErrorBoundary>
											<MetricsSummary
												filteredRuns={filteredRuns}
												evaluations={evaluations}
												selectedCriteria={selectedCriteria}
												metrics={metrics}
											/>
										</ErrorBoundary>
									</div>
								</div>
							</div>
						) : (
							<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-fade-in">
								<div className="flex justify-between items-center mb-2">
									<label className="text-sm font-medium text-gray-700">
										Select Evaluation Metrics
									</label>
									<ErrorBoundary>
										<AddMetricDialog onMetricAdded={() => {
											// Refresh metrics when a new one is added
											fetch(`${API_BASE_URL}/metrics`)
												.then(response => response.json())
												.then(data => setMetrics(data))
												.catch(error => {
													console.error('Error fetching metrics:', error);
													toast({
														variant: "destructive",
														title: "Error",
														description: "Failed to refresh metrics",
													});
												});
										}} />
									</ErrorBoundary>
								</div>
								<div className="flex gap-2">
									{Object.keys(metrics).map((criteria) => (
										<Badge
											key={criteria}
											variant={selectedCriteria.includes(criteria) ? "default" : "outline"}
											className="cursor-pointer"
											onClick={() => handleCriteriaChange(criteria)}
										>
											{metrics[criteria].name}
										</Badge>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Main Content Box */}
					<div className="bg-white rounded-lg border border-gray-100 flex flex-col flex-1 min-h-0 animate-fade-in">
						<ErrorBoundary>
							<div className="border-b border-gray-200 p-4 flex-none">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={toggleAllStaged}
										>
											{(viewMode === 'runs' ? filteredRuns : sessions).every(item => isItemStaged(item))
												? 'Unselect All'
												: 'Select All'
											}
										</Button>
										<span className="text-sm text-gray-600">
											{stagedItems[viewMode].size} items staged ({getTotalTokens().toLocaleString()} tokens)
										</span>
									</div>
									<Button
										variant="outline"
										size="sm"
										className="flex items-center gap-2"
										onClick={handleEvaluateAll}
										disabled={stagedItems[viewMode].size === 0 || selectedCriteria.length === 0}
									>
										<Calculator className="w-4 h-4" />
										<span className="text-xs">Evaluate Staged</span>
									</Button>
								</div>
								<RunsFilter
									filterOptions={getFilterOptions}
									filters={filters}
									onFilterChange={setFilters}
								/>
							</div>
						</ErrorBoundary>

						<ErrorBoundary>
							<Spreadsheet
								columns={currentColumns}
								data={viewMode === 'runs' ? filteredRuns : sessions}
								onRowClick={handleRowClick}
								selectedItem={viewMode === 'runs' ? selectedRun : selectedSession}
								onColumnResize={handleColumnResize}
								onFilter={handleFilter}
								isItemStaged={isItemStaged}
							/>
						</ErrorBoundary>
					</div>

					{/* Side Pane */}
					{(selectedRun || selectedSession) && (
						<ErrorBoundary>
							<SidePane
								run={selectedRun || (selectedSession?.runs[0] ?? null)}
								onClose={() => viewMode === 'runs' ? setSelectedRun(null) : setSelectedSession(null)}
								evaluations={selectedRun
									? (evaluations[getRunId(selectedRun)] || [])
									: (selectedSession?.runs.flatMap(run => evaluations[getRunId(run)] || []) || [])
								}
								selectedCriteria={selectedCriteria}
								metrics={metrics}
								onAutoEvaluate={() => selectedRun && handleAutoEvaluate(selectedRun)}
								sessionRuns={selectedSession?.runs}
							/>
						</ErrorBoundary>
					)}
				</>
			)}
		</div>
	);
} 