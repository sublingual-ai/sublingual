import { LLMRun } from "@/types/logs";
import { Evaluation, Metrics } from "@/types/metrics";
import { Progress } from "@/components/ui/progress";
import { getRunId } from "@/utils/metrics";

interface MetricsSummaryProps {
    filteredRuns: LLMRun[];
    evaluations: Record<string, Evaluation[]>;
    selectedCriteria: string[];
    metrics: Metrics;
}

export function MetricsSummary({ filteredRuns, evaluations, selectedCriteria, metrics }: MetricsSummaryProps) {
    const metricsData = selectedCriteria.map(criteria => {
        const metric = metrics[criteria];
        const filteredRunIds = new Set(filteredRuns.map(run => getRunId(run)));
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

    if (selectedCriteria.length === 0) return null;

    return (
        <div className="grid grid-cols-1 gap-3">
            {metricsData.map(metric => (
                <div key={metric.criteria} className="flex items-center">
                    <div className="w-1/3 pr-4 text-sm text-gray-600">
                        {metrics[metric.criteria].name}
                    </div>
                    <div className="w-2/3">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-primary-600 font-medium">
                                {metric.gradedRuns > 0 ? (
                                    metric.isBoolean ?
                                        `${metric.yesCount} Yes, ${metric.noCount} No` :
                                        `${metric.averageScore.toFixed(1)}`
                                ) : (
                                    "No data yet"
                                )}
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
} 