import { useState, useMemo } from "react";
import { LLMRun } from "@/types/logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Zap, Clock, Hash, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LLMInteraction } from "@/components/LLMInteraction";
import { formatElapsedTime } from "@/utils/format";

interface DashboardViewProps {
  runs: LLMRun[];
}

type MetricType = 'calls' | 'tokens' | 'duration';
type TimeRange = '1h' | '24h' | '7d' | '30d';
type BucketSize = Record<TimeRange, number>;

const BUCKET_SIZES: BucketSize = {
  '1h': 5 * 60 * 1000,    // 5 minutes
  '24h': 60 * 60 * 1000,  // 1 hour
  '7d': 6 * 60 * 60 * 1000,  // 6 hours
  '30d': 24 * 60 * 60 * 1000,  // 24 hours
};

interface DataPoint {
  timestamp: number;
  calls: number;
  tokens: number;
  duration: number;
}

export function DashboardView({ runs }: DashboardViewProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('calls');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [expandedRuns, setExpandedRuns] = useState<string[]>([]);

  const chartData = useMemo(() => {
    if (runs.length === 0) return [];

    const msPerBucket = BUCKET_SIZES[timeRange];
    const now = Date.now();
    const rangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const minTime = now - rangeMs;
    const maxTime = now;

    const bucketStart = Math.floor(minTime / msPerBucket) * msPerBucket;

    const buckets = new Map<number, DataPoint>();

    // Initialize buckets from bucketStart to maxTime
    for (let t = bucketStart; t <= maxTime; t += msPerBucket) {
      buckets.set(t, {
        timestamp: t,
        calls: 0,
        tokens: 0,
        duration: 0
      });
    }

    // Fill buckets with run data
    runs.forEach(run => {
      const timestamp = run.timestamp * 1000;
      if (timestamp < minTime || timestamp > maxTime) return;

      const bucketTime = Math.floor(timestamp / msPerBucket) * msPerBucket;
      const bucket = buckets.get(bucketTime) || {
        timestamp: bucketTime,
        calls: 0,
        tokens: 0,
        duration: 0
      };

      bucket.calls += 1;
      bucket.tokens += run.response.usage.total_tokens;
      if ('duration_ms' in run) {
        bucket.duration = ((bucket.duration * (bucket.calls - 1)) + run.duration_ms) / bucket.calls;
      }
      buckets.set(bucketTime, bucket);
    });

    return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [runs, timeRange, selectedMetric]);

  const yAxisLabel = {
    calls: 'Number of Calls',
    tokens: 'Total Tokens',
    duration: 'Average Duration'
  }[selectedMetric];

  const stats = useMemo(() => {
    const models = new Set<string>();
    let totalTokens = 0;
    let totalCalls = runs.length;
    let totalSessions = new Set(runs.map(run => run.session_id || 'single')).size;
    let totalDuration = 0;

    runs.forEach(run => {
      models.add(run.response.model);
      totalTokens += run.response.usage.total_tokens;
      if ('duration_ms' in run) {
        totalDuration += run.duration_ms;
      }
    });

    return {
      uniqueModels: Array.from(models),
      totalTokens,
      totalCalls,
      totalSessions,
      avgDuration: totalCalls > 0 ? totalDuration / totalCalls : 0
    };
  }, [runs]);

  const recentRuns = useMemo(() => {
    return [...runs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [runs]);

  const toggleRun = (runId: string) => {
    setExpandedRuns(prev =>
      prev.includes(runId)
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatElapsedTime(Math.round(stats.avgDuration))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Traffic Over Time</CardTitle>
            <div className="flex gap-2">
              <Select value={selectedMetric} onValueChange={(value: MetricType) => setSelectedMetric(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calls">Number of Calls</SelectItem>
                  <SelectItem value="tokens">Total Tokens</SelectItem>
                  <SelectItem value="duration">Average Duration</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData} 
                margin={{ top: 20, right: 20, left: 35, bottom: 20 }}
                height={160}
              >
                <CartesianGrid 
                  vertical={false}
                  strokeDasharray="3 3"  // Make grid lines dashed
                />
                <XAxis 
                  dataKey="timestamp"
                  padding={{ right: 10 }}
                  axisLine={true}
                  tickLine={true}
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp);
                    if (timeRange === '1h' || timeRange === '24h') {
                      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    }
                  }}
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis 
                  allowDecimals={false}
                  domain={[0, 'dataMax']}
                  width={35}
                  tickFormatter={(value) => value.toLocaleString()}
                  scale="linear"
                  orientation="left"
                  axisLine={true}
                  tickLine={true}
                  ticks={(() => {
                    const max = Math.max(...chartData.map(point => point[selectedMetric]));
                    const adjustedMax = max % 2 === 1 ? max + 1 : max;
                    return [0, adjustedMax / 2, adjustedMax];
                  })()}
                />
                <Tooltip
                  labelFormatter={(timestamp) => {
                    const date = new Date(timestamp);
                    return timeRange === '1h' 
                      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  }}
                  formatter={(value) => [
                    selectedMetric === 'duration' 
                      ? formatElapsedTime(Number(value))
                      : value.toLocaleString()
                  ]}
                  isAnimationActive={false}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    fontSize: '14px'
                  }}
                  labelStyle={{ color: '#64748b', fontSize: '12px' }}
                  itemStyle={{ color: '#2563eb' }}
                />
                <Line
                  type="linear"  // Straight line between neighboring points
                  dataKey={selectedMetric}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={(props) => {
                    // Only display a dot if the value is non-zero
                    const value = props.payload[selectedMetric];
                    return value > 0 ? (
                      <circle 
                        cx={props.cx} 
                        cy={props.cy} 
                        r={3} 
                        fill="#2563eb" 
                      />
                    ) : null;
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="divide-y divide-gray-100">
                {recentRuns.map((run, index) => {
                  const runId = `recent-${index}`;
                  const isExpanded = expandedRuns.includes(runId);
                  
                  return (
                    <div key={index} className="py-2">
                      <div 
                        className={`flex items-center justify-between mb-1 cursor-pointer hover:bg-gray-50 p-2 rounded-md ${
                          isExpanded ? 'bg-primary-50/50' : ''
                        }`}
                        onClick={() => toggleRun(runId)}
                      >
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(run.timestamp * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-600">
                            <span className="text-primary-600 font-medium">{run.response.model}</span>
                            <span>•</span>
                            <span>{run.response.usage.total_tokens} tokens</span>
                            <span>•</span>
                            <span>{formatElapsedTime(run.duration_ms)}</span>
                          </div>
                        </div>
                        <ChevronRight 
                          className={`w-4 h-4 transition-transform ${
                            isExpanded ? 'text-primary-600 rotate-90' : 'text-gray-500'
                          }`}
                        />
                      </div>
                      {isExpanded && <LLMInteraction run={run} />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
