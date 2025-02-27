import { useMemo, useState, useEffect } from "react";
import { LLMRun, Message } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Calculator, Loader2, ChevronRight, Minus, X } from "lucide-react";
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
import { Filter, FilterOption } from "@/types/logs";
import { Input } from "@/components/ui/input";
import { RunsFilter } from "@/components/RunsFilter";
import { useToast } from "@/components/ui/use-toast";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface SidePaneProps {
	run: LLMRun;
	onClose: () => void;
	evaluations: Evaluation[];
	selectedCriteria: string[];
	metrics: Metrics;
	onAutoEvaluate: () => void;
	sessionRuns?: LLMRun[];
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

const formatTimestamp = (timestamp: number) => {
	const date = new Date(timestamp * 1000);
	return date.toLocaleString('en-US', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).replace(',', '');
};

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
	selectedCriteria,
	metrics
}: {
	filteredRuns: LLMRun[];
	evaluations: Record<string, Evaluation[]>;
	selectedCriteria: EvaluationCriteria[];
	metrics: Record<string, Metric>;
}) => {
	const metricsData = useMemo(() => {
		return selectedCriteria.map(criteria => {
			const metric = metrics[criteria];
			const filteredRunIds = new Set(filteredRuns.map(getRunId));
			const relevantEvals = Object.entries(evaluations)
				.filter(([runId]) => filteredRunIds.has(runId))
				.flatMap(([_, evals]) =>
					evals.filter(e => e.criteria === criteria && e.status === 'evaluated')
				);

			const totalRuns = filteredRuns.length;
			const gradedRuns = relevantEvals.length;

			if (metric.tool_type === 'bool') {
				const yesCount = relevantEvals.filter(e => e.rating === true).length;
				return {
					criteria,
					isBoolean: true,
					yesCount,
					noCount: gradedRuns - yesCount,
					gradedRuns,
					totalRuns,
					completionRate: Math.round((gradedRuns / totalRuns) * 100)
				};
			} else {
				const sum = relevantEvals
					.filter(e => typeof e.rating === 'number')
					.reduce((sum, e) => sum + (e.rating as number), 0);
				const averageScore = gradedRuns > 0 ? sum / gradedRuns : 0;
				const progressValue = metric.tool_type === 'int' ? 
					((averageScore - metric.min_val) / (metric.max_val - metric.min_val)) * 100 : 0;
				return {
					criteria,
					isBoolean: false,
					averageScore,
					progressValue,
					gradedRuns,
					totalRuns,
					completionRate: Math.round((gradedRuns / totalRuns) * 100)
				};
			}
		});
	}, [filteredRuns, evaluations, selectedCriteria, metrics]);

	if (selectedCriteria.length === 0) return null;

	return (
		<div className="grid grid-cols-1 gap-3 mt-4">
			{metricsData.map(metric => (
				<div key={metric.criteria} className="flex items-center gap-4">
					<div className="w-40 text-sm text-gray-600">
						{metrics[metric.criteria].name}
					</div>
					<div className="flex-1">
						<div className="flex justify-between text-sm mb-1">
							<span className="text-primary-600 font-medium">
								{metric.isBoolean ?
									`${metric.yesCount} Yes, ${metric.noCount} No` :
									`${metric.averageScore.toFixed(1)}`
								}
							</span>
							<span className="text-gray-500">
								{metric.gradedRuns}/{metric.totalRuns} graded
							</span>
						</div>
						<div className="flex gap-1">
							{metric.isBoolean ? (
								<div className="flex-1 flex gap-1">
									<Progress
										value={metric.gradedRuns > 0 ? (metric.yesCount / metric.gradedRuns) * 100 : 0}
										className="flex-1"
									/>
								</div>
							) : (
								<Progress
									value={metric.progressValue}
									className="flex-1"
								/>
							)}
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

function AddMetricDialog({ onMetricAdded }: { onMetricAdded: () => void }) {
	const [isOpen, setIsOpen] = useState(false);
	const [newMetric, setNewMetric] = useState<NewMetric>({
		name: '',
		prompt: '',
		tool_type: 'int',
		min_val: 0,
		max_val: 100
	});
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch(`${API_BASE_URL}/metrics/add`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(newMetric)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to add metric');
			}

			toast({
				title: "Success",
				description: "New metric added successfully",
			});
			setIsOpen(false);
			onMetricAdded();
		} catch (error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to add metric",
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-2">
					<Plus className="w-4 h-4" />
					<span>Add Metric</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Add New Evaluation Metric</DialogTitle>
					<DialogDescription>
						Create a new metric for evaluating LLM responses
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Label htmlFor="name">Name</Label>
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger type="button" asChild>
										<HelpCircle className="h-4 w-4 text-gray-500" />
									</TooltipTrigger>
									<TooltipContent side="right">
										<p>A short, descriptive name for the metric that will appear in the UI</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<Input
							id="name"
							value={newMetric.name}
							onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
							placeholder="e.g., Response Quality"
							required
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Label htmlFor="prompt">Evaluation Prompt</Label>
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger type="button" asChild>
										<HelpCircle className="h-4 w-4 text-gray-500" />
									</TooltipTrigger>
									<TooltipContent side="right">
										<p>The prompt that will be given to the LLM to evaluate this metric</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<Textarea
							id="prompt"
							value={newMetric.prompt}
							onChange={(e) => setNewMetric(prev => ({ ...prev, prompt: e.target.value }))}
							placeholder="Describe how to evaluate this metric..."
							className="min-h-[200px]"
							required
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Label htmlFor="tool_type">Evaluation Type</Label>
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger type="button" asChild>
										<HelpCircle className="h-4 w-4 text-gray-500" />
									</TooltipTrigger>
									<TooltipContent side="right">
										<p>Choose whether this metric should be evaluated as a number or a yes/no question</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<Select
							value={newMetric.tool_type}
							onValueChange={(value) => setNewMetric(prev => ({ ...prev, tool_type: value }))}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select evaluation type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="int">Numeric Score</SelectItem>
								<SelectItem value="bool">Yes/No</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{newMetric.tool_type === 'int' && (
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="min_val">Minimum Value</Label>
								<Input
									id="min_val"
									type="number"
									value={newMetric.min_val}
									onChange={(e) => setNewMetric(prev => ({ ...prev, min_val: parseInt(e.target.value) }))}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="max_val">Maximum Value</Label>
								<Input
									id="max_val"
									type="number"
									value={newMetric.max_val}
									onChange={(e) => setNewMetric(prev => ({ ...prev, max_val: parseInt(e.target.value) }))}
									required
								/>
							</div>
						</div>
					)}

					<Button type="submit" className="w-full">Add Metric</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const SidePane = ({ run, onClose, evaluations, selectedCriteria, metrics, onAutoEvaluate, sessionRuns }: SidePaneProps) => {
	console.log('SidePane evaluations:', evaluations);
	console.log('SidePane selectedCriteria:', selectedCriteria);
	console.log('SidePane metrics:', metrics);
	
	return (
		<div 
			className="fixed inset-y-0 right-0 w-1/2 bg-white border-l border-gray-200 shadow-xl z-50
				transform transition-transform duration-200 ease-out"
		>
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
						{/* Basic Info Section */}
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
							</div>
						</div>

						{/* Evaluations Section */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-medium text-gray-700">Evaluations</h3>
								<Button
									variant="outline"
									size="sm"
									className="flex items-center gap-2"
									onClick={onAutoEvaluate}
								>
									<Calculator className="w-4 h-4" />
									<span className="text-xs">Evaluate Metrics</span>
								</Button>
							</div>
							<div className="bg-gray-50 p-3 rounded-lg">
								<div className="flex flex-wrap gap-2">
									{Object.entries(metrics).map(([criteria, metric]) => {
										const evaluation = evaluations.find(e => e.criteria === criteria);
										
										// Skip if there's no evaluation or if it's not in an evaluated state
										if (!evaluation || evaluation.status !== 'evaluated') return null;

										const value = metric.tool_type === 'bool' 
											? (evaluation.rating ? 'Yes' : 'No') 
											: typeof evaluation.rating === 'number' 
												? `${evaluation.rating}${metric.tool_type === 'int' ? '%' : ''}` 
												: evaluation.rating;

										return (
											<Badge
												key={criteria}
												variant="outline"
												className="bg-primary-50/50 border-primary-100 text-primary-700"
											>
												{metric.name}: {value}
											</Badge>
										);
									}).filter(Boolean)}
								</div>
							</div>
						</div>
						
						{/* Interaction Section */}
						<div className="space-y-2">
							<h3 className="text-sm font-medium text-gray-700">Interaction</h3>
							<LLMInteraction run={run} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const TableHeader = ({ 
	metrics, 
	selectedCriteria,
	onColumnResize 
}: { 
	metrics: Metrics, 
	selectedCriteria: string[],
	onColumnResize: (column: string, event: React.MouseEvent) => void 
}) => {
	return (
		<div className="grid border-b border-[#E2E3E3] bg-white sticky top-0 z-10 shadow-sm"
			style={{
				gridTemplateColumns: `160px 1fr 120px 80px ${selectedCriteria.map(() => '80px').join(' ')}`
			}}
		>
			<div className="px-3 py-2 text-xs font-semibold text-gray-900 border-r border-[#E2E3E3] flex items-center">
				<div className="flex-1">Timestamp</div>
				<div 
					className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded" 
					onMouseDown={(e) => onColumnResize('timestamp', e)}
				/>
			</div>
			<div className="px-3 py-2 text-xs font-semibold text-gray-900 border-r border-[#E2E3E3] flex items-center">
				<div className="flex-1">Message</div>
				<div 
					className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded" 
					onMouseDown={(e) => onColumnResize('message', e)}
				/>
			</div>
			<div className="px-3 py-2 text-xs font-semibold text-gray-900 border-r border-[#E2E3E3] flex items-center">
				<div className="flex-1">Model</div>
				<div 
					className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded" 
					onMouseDown={(e) => onColumnResize('model', e)}
				/>
			</div>
			<div className="px-3 py-2 text-xs font-semibold text-gray-900 border-r border-[#E2E3E3] flex items-center">
				<div className="flex-1">Temp</div>
				<div 
					className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded" 
					onMouseDown={(e) => onColumnResize('temp', e)}
				/>
			</div>
			{selectedCriteria.map((criteria, i) => (
				<div key={criteria} className={`px-3 py-2 text-xs font-semibold text-gray-900 text-center flex items-center ${
					i !== selectedCriteria.length - 1 ? 'border-r border-[#E2E3E3]' : ''
				}`}>
					<div className="flex-1">{metrics[criteria].name}</div>
					{i !== selectedCriteria.length - 1 && (
						<div 
							className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded" 
							onMouseDown={(e) => onColumnResize(criteria, e)}
						/>
					)}
				</div>
			))}
		</div>
	);
};

const Spreadsheet = ({ columns, data, onRowClick, selectedItem, onColumnResize }: SpreadsheetProps) => {
	return (
		<div className="flex-1 overflow-auto">
			<div className="grid border-b border-[#E2E3E3] bg-white sticky top-0 z-10 shadow-sm"
				style={{
					gridTemplateColumns: columns.map(col => `${col.width}px`).join(' ')
				}}
			>
				{columns.map((col, i) => (
					<div key={col.id} className={`px-3 py-2 text-xs font-semibold text-gray-900 flex items-center ${
						i !== columns.length - 1 ? 'border-r border-[#E2E3E3]' : ''
					}`}>
						<div className="flex-1">{col.name}</div>
						{i !== columns.length - 1 && (
							<div 
								className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded"
								onMouseDown={(e) => onColumnResize(col.id, e)}
							/>
						)}
					</div>
				))}
			</div>

			<div className="divide-y divide-gray-100">
				{data.map((item, rowIndex) => (
					<div 
						key={rowIndex}
						className={`grid hover:bg-[#F3F3F3] cursor-pointer ${
							selectedItem === item ? 'bg-[#E8F0FE]' : ''
						}`}
						style={{
							gridTemplateColumns: columns.map(col => `${col.width}px`).join(' ')
						}}
						onClick={() => onRowClick(item)}
					>
						{columns.map((col, i) => (
							<div key={col.id} className={`px-3 py-[6px] text-xs text-gray-700 ${
								i !== columns.length - 1 ? 'border-r border-[#E2E3E3]' : ''
							} ${col.align ? `text-${col.align}` : ''} truncate`}>
								{col.getValue(item)}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
};

// Add this helper function to group runs into sessions
const groupRunsIntoSessions = (runs: LLMRun[]): SessionRow[] => {
	const sessionMap = new Map<string, SessionRow>();
	
	runs.forEach(run => {
		const sessionId = run.session_id || getRunId(run);
		const existing = sessionMap.get(sessionId);
		
		if (existing) {
			existing.runs.push(run);
			existing.lastCall = Math.max(existing.lastCall, run.timestamp);
			existing.callCount += 1;
			existing.totalTokens += run.usage.total_tokens;
		} else {
			sessionMap.set(sessionId, {
				sessionId,
				runs: [run],
				firstCall: run.timestamp,
				lastCall: run.timestamp,
				callCount: 1,
				totalTokens: run.usage.total_tokens
			});
		}
	});
	
	return Array.from(sessionMap.values());
};

export function MetricsView({ runs }: MetricsViewProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [selectedCriteria, setSelectedCriteria] = useState<EvaluationCriteria[]>([]);
	const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
	const [loadingStates, setLoadingStates] = useState<LoadingState>({});
	const [filters, setFilters] = useState<Filter[]>([]);
	const { toast } = useToast();
	const [metrics, setMetrics] = useState<Metrics>({});
	const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>({
		isOpen: false,
		existingEvals: {},
		onConfirm: () => {},
		onCancel: () => {}
	});
	const [selectedRun, setSelectedRun] = useState<LLMRun | null>(null);
	const [columnWidths, setColumnWidths] = useState({
		timestamp: 160,
		message: 500,
		model: 120,
		temp: 80,
		metrics: {} as Record<string, number>
	});
	const [viewMode, setViewMode] = useState<ViewMode>('runs');

	// Add this useEffect to fetch metrics
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

	// Add this useEffect after the metrics fetch useEffect
	useEffect(() => {
		const fetchExistingEvaluations = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/evaluations`);
				if (!response.ok) throw new Error('Failed to fetch evaluations');
				const data = await response.json();
				console.log('Fetched evaluations:', data);  // Add this debug log
				
				// Convert the loaded evaluations into our frontend format
				const formattedEvals: Record<string, Evaluation[]> = {};
				Object.entries(data).forEach(([runId, runEvals]: [string, Record<string, any>]) => {
					formattedEvals[runId] = Object.entries(runEvals).map(([criteria, rating]) => ({
						criteria,
						rating,
						status: 'evaluated' as EvaluationStatus
					}));
				});
				
				console.log('Formatted evaluations:', formattedEvals);  // Add this debug log
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
	}, []);  // Empty dependency array means this runs once on mount

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

	// Update this effect to merge with existing evaluations instead of replacing
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

	// Update this effect to preserve loaded evaluations
	useEffect(() => {
		setIsLoading(true);
		setSelectedCriteria([]);
		setFilters([]);
		setTimeout(() => setIsLoading(false), 100);
	}, [runs]);

	const toggleRun = (run: LLMRun) => {
		setSelectedRun(selectedRun?.timestamp === run.timestamp ? null : run);
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

<<<<<<< HEAD
        const getBadgeStyle = (criteria: string, rating: number) => {
            if (criteria === 'correctness') {
                if (rating >= 75) return 'bg-green-50 text-green-700';
                if (rating >= 25) return 'bg-yellow-50 text-yellow-700';
                if (rating >= 0) return 'bg-orange-50 text-orange-700';
            }
            return 'bg-primary-50 text-primary-700';
        };

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

                    const badgeStyle = evaluation?.status === 'evaluated' 
                        ? getBadgeStyle(criteria, evaluation.rating)
                        : evaluation?.status === 'evaluation_failed' 
                            ? 'bg-red-50 text-red-700' 
                            : 'text-gray-500';

                    return (
                        <Badge
                            key={criteria}
                            variant="outline"
                            className={`text-xs ${badgeStyle}`}
                        >
                            {metrics[criteria].name}: {displayValue()}
                        </Badge>
                    );
                })}
            </div>
        );
    };
=======
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
>>>>>>> 8c778fd (you can add evals now)

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

	const handleColumnResize = (column: string, event: React.MouseEvent) => {
		const startX = event.pageX;
		const startWidth = column === 'metrics' 
			? (columnWidths.metrics[event.currentTarget.getAttribute('data-metric') || ''] || 80)
			: columnWidths[column as keyof typeof columnWidths] as number;

		const handleMouseMove = (e: MouseEvent) => {
			const diff = e.pageX - startX;
			const newWidth = Math.max(50, startWidth + diff);
			
			setColumnWidths(prev => {
				if (column === 'metrics') {
					const metric = event.currentTarget.getAttribute('data-metric');
					if (!metric) return prev;
					return {
						...prev,
						metrics: {
							...prev.metrics,
							[metric]: newWidth
						}
					};
				}
				return {
					...prev,
					[column]: newWidth
				};
			});
		};

		const handleMouseUp = () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
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
	const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

	// Update columns to include metrics
	const getMetricColumns = (): SpreadsheetColumn[] => 
		selectedCriteria.map(criteria => ({
			id: criteria,
			name: metrics[criteria].name,
			width: columnWidths.metrics[criteria] || 80,
			align: 'center' as const,
			getValue: (item: LLMRun | SessionRow) => {
				if ('runs' in item) { // SessionRow
					const sessionEvals = item.runs.map(run => 
						evaluations[getRunId(run)]?.find(e => e.criteria === criteria)
					).filter(e => e?.status === 'evaluated');
					
					if (sessionEvals.length === 0) return '-';
					
					// Average the ratings
					const avg = sessionEvals.reduce((sum, e) => sum + (typeof e?.rating === 'number' ? e.rating : 0), 0) / sessionEvals.length;
					return `${Math.round(avg)}%`;
				} else { // LLMRun
					const evaluation = evaluations[getRunId(item)]?.find(e => e.criteria === criteria);
					if (!evaluation || evaluation.status !== 'evaluated') return '-';
					
					return metrics[criteria].tool_type === 'bool'
						? (evaluation.rating ? 'Yes' : 'No')
						: `${evaluation.rating}${metrics[criteria].tool_type === 'int' ? '%' : ''}`;
				}
			}
		}));

	const currentColumns = useMemo(() => {
		const baseColumns = viewMode === 'runs' ? runColumns : sessionColumns;
		return [...baseColumns, ...getMetricColumns()];
	}, [viewMode, selectedCriteria, metrics, columnWidths]);

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
											Evaluation Criteria
										</label>
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
										<MetricsSummary
											filteredRuns={filteredRuns}
											evaluations={evaluations}
											selectedCriteria={selectedCriteria}
											metrics={metrics}
										/>
									</div>
								</div>
							</div>
						) : (
							<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-fade-in">
								<div className="flex justify-between items-center mb-2">
									<label className="text-sm font-medium text-gray-700">
										Evaluation Criteria
									</label>
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
						<div className="border-b border-gray-200 p-4 flex-none">
							<RunsFilter
								filterOptions={getFilterOptions}
								filters={filters}
								onFilterChange={setFilters}
							/>
						</div>

						<Spreadsheet
							columns={currentColumns}
							data={viewMode === 'runs' ? filteredRuns : sessions}
							onRowClick={handleRowClick}
							selectedItem={viewMode === 'runs' ? selectedRun : selectedSession}
							onColumnResize={handleColumnResize}
						/>
					</div>

					{/* Side Pane */}
					{(selectedRun || selectedSession) && (
						<SidePane
							run={selectedRun || selectedSession?.runs[0]}
							onClose={() => viewMode === 'runs' ? setSelectedRun(null) : setSelectedSession(null)}
							evaluations={selectedRun 
								? evaluations[getRunId(selectedRun)] || []
								: selectedSession?.runs.flatMap(run => evaluations[getRunId(run)] || []) || []
							}
							selectedCriteria={selectedCriteria}
							metrics={metrics}
							onAutoEvaluate={() => selectedRun && handleAutoEvaluate(selectedRun)}
							sessionRuns={selectedSession?.runs}
						/>
					)}
				</>
			)}
		</div>
	);
} 