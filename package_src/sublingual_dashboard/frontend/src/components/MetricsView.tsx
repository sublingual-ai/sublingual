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

import { MetricsSummary } from "./MetricsSummary";
import { AddMetricDialog } from "./AddMetricDialog";
import { OverwriteConfirmationDialog } from "./OverwriteConfirmationDialog";
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

interface ConfirmationDialogState {
	isOpen: boolean;
	existingEvals: Record<string, string[]>;
	onConfirm: () => void;
	onCancel: () => void;
}

type ViewMode = 'runs' | 'sessions';

interface SpreadsheetColumn {
	id: string;
	name: string;
	width: number;
	getValue: (item: any) => string | number;
	align?: 'left' | 'center' | 'right';
}

interface SpreadsheetProps {
	columns: SpreadsheetColumn[];
	data: any[];
	onRowClick: (item: any) => void;
	selectedItem: any | null;
	onColumnResize: (columnId: string, event: React.MouseEvent) => void;
}

interface SessionRow {
	sessionId: string;
	runs: LLMRun[];
	firstCall: number;
	lastCall: number;
	callCount: number;
	totalTokens: number;
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
	const [confirmationDialog, setConfirmationDialog] = useState({
		isOpen: false,
		existingEvals: {} as Record<string, string[]>,
		onConfirm: () => {},
		onCancel: () => {}
	});
	const [columnWidths, setColumnWidths] = useState({
		timestamp: 160,
		message: 500,
		model: 120,
		temp: 80,
		metrics: {} as Record<string, number>
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
					check_existing: true
				})
			});

			if (!response.ok) {
				if (response.status === 503) {
					console.error("OpenAI Client Error");
					toast({
						variant: "destructive",
						title: "OpenAI Client Error",
						description: "Failed to initialize OpenAI client. Please ensure you have provided your API key in the .env file.",
					});
				}
				throw new Error('Evaluation request failed');
			}

			const data: EvaluationResponse = await response.json();
			
			if (data.existing_evaluations && Object.keys(data.existing_evaluations).length > 0) {
				const confirmed = await new Promise<boolean>((resolve) => {
					setConfirmationDialog({
						isOpen: true,
						existingEvals: data.existing_evaluations!,
						onConfirm: () => resolve(true),
						onCancel: () => resolve(false),
					});
				});

				if (!confirmed) {
					return;
				}
			}

			const saveResponse = await fetch(`${API_BASE_URL}/evaluate`, {
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

			if (!saveResponse.ok) throw new Error('Failed to save evaluations');
			const saveData = await saveResponse.json();

			setEvaluations(prev => {
				const currentEvals = prev[runId] || [];
				const newEvals = criteriaToEvaluate.map(criteria => ({
					criteria,
					rating: saveData.scores[criteria] === "<NO_SCORE>" ? 0 : 
						metrics[criteria].tool_type === 'bool' ? saveData.scores[criteria] === 'true' || saveData.scores[criteria] === true :
						parseInt(saveData.scores[criteria], 10),
					status: (saveData.scores[criteria] === "<NO_SCORE>" ? 'evaluation_failed' : 'evaluated') as EvaluationStatus
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

	const handleEvaluateAll = async () => {
		// Get all filtered runs that have unevaluated criteria
		const runsToEvaluate = filteredRuns.filter(run => {
			const runId = getRunId(run);
			const existingEvals = evaluations[runId] || [];
			return selectedCriteria.some(criteria =>
				!existingEvals.some(evaluation =>
					evaluation.criteria === criteria && evaluation.status === 'evaluated'
				)
			);
		});

		// Evaluate each filtered run
		for (const run of runsToEvaluate) {
			await handleAutoEvaluate(run);
		}
	};

	const OverwriteConfirmationDialog = () => (
		<AlertDialog 
			open={confirmationDialog.isOpen} 
			onOpenChange={(open) => {
				if (!open) confirmationDialog.onCancel();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Overwrite Existing Evaluations?</AlertDialogTitle>
					<div className="space-y-2 text-sm text-muted-foreground">
						<AlertDialogDescription>
							The following criteria already have evaluations:
						</AlertDialogDescription>
						<ul className="list-disc list-inside">
							{Object.entries(confirmationDialog.existingEvals).map(([criteria, runs]) => (
								<li key={criteria}>
									{metrics[criteria].name} ({runs.length} evaluation{runs.length !== 1 ? 's' : ''})
								</li>
							))}
						</ul>
						<AlertDialogDescription>
							Do you want to overwrite these evaluations?
						</AlertDialogDescription>
					</div>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={confirmationDialog.onCancel}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={confirmationDialog.onConfirm}>
						Yes, Overwrite
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);

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
					const filename = frame.filename.split('/').pop() || frame.filename;
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

	const currentColumns = useMemo(() => {
		const baseColumns = viewMode === 'runs' ? runColumns.map(col => ({
			...col,
			width: (columnWidths[col.id as keyof typeof columnWidths] as number) || col.width
		})) : sessionColumns;
		
		return [...baseColumns, ...getMetricColumns()];
	}, [viewMode, selectedCriteria, metrics, columnWidths, runColumns, sessionColumns]);

	const handleRowClick = (item: LLMRun | SessionRow) => {
		if ('runs' in item) {
			setSelectedSession(selectedSession?.sessionId === item.sessionId ? null : item);
			setSelectedRun(null);
		} else {
			setSelectedRun(selectedRun?.timestamp === item.timestamp ? null : item);
			setSelectedSession(null);
		}
	};

	return (
		<div className="space-y-4 h-full flex flex-col">
			<div className="flex-none">
				<div className="bg-white rounded-lg border border-gray-100 p-2">
					<div className="flex gap-2">
						<button
							className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
								viewMode === 'runs' 
									? 'bg-primary-50 text-primary-900' 
									: 'text-gray-600 hover:bg-gray-50'
							}`}
							onClick={() => setViewMode('runs')}
						>
							Run View
						</button>
						<button
							className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
								viewMode === 'sessions' 
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

			<OverwriteConfirmationDialog />
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
											>
												<Calculator className="w-4 h-4" />
												<span className="text-xs">Evaluate All</span>
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