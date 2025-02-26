import { useState, useMemo } from "react";
import { LLMRun } from "@/types/logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Zap, Clock, Hash, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LLMInteraction } from "@/components/LLMInteraction";

interface DashboardViewProps {
  runs: LLMRun[];
}

type MetricType = 'calls' | 'tokens' | 'response_time';
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
  response_time: number;
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

    // Align the starting bucket to a multiple of msPerBucket
    const bucketStart = Math.floor(minTime / msPerBucket) * msPerBucket;

    const buckets = new Map<number, DataPoint>();

    // Initialize buckets from bucketStart to maxTime
    for (let t = bucketStart; t <= maxTime; t += msPerBucket) {
      buckets.set(t, {
        timestamp: t,
        calls: 0,
        tokens: 0,
        response_time: 0
      });
    }

    // Fill buckets with run data
    runs.forEach(run => {
      const timestamp = run.timestamp * 1000;
      if (timestamp < minTime || timestamp > maxTime) return; // only include points in our range

      // Bucket by flooring to the nearest bucket start
      const bucketTime = Math.floor(timestamp / msPerBucket) * msPerBucket;
      const bucket = buckets.get(bucketTime) || {
        timestamp: bucketTime,
        calls: 0,
        tokens: 0,
        response_time: 0
      };

      bucket.calls += 1;
      bucket.tokens += run.response.usage.total_tokens;
      if ('completion_ms' in run.response.usage) {
        bucket.response_time += run.response.usage.completion_ms;
      }
      buckets.set(bucketTime, bucket);
    });

    // Calculate averages for response_time where applicable
    buckets.forEach(bucket => {
      if (bucket.calls > 0) {
        bucket.response_time /= bucket.calls;
      }
    });

    // Return all buckets as sorted data points
    return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [runs, timeRange, selectedMetric]);

  const yAxisLabel = {
    calls: 'Number of Calls',
    tokens: 'Total Tokens',
    response_time: 'Avg Response Time (ms)'
  }[selectedMetric];

  const stats = useMemo(() => {
    const models = new Set<string>();
    let totalTokens = 0;
    let totalCalls = runs.length;
    let totalSessions = new Set(runs.map(run => run.session_id || 'single')).size;
    let avgResponseTime = 0;

    runs.forEach(run => {
      models.add(run.response.model);
      totalTokens += run.response.usage.total_tokens;
      if ('completion_ms' in run.response.usage) {
        avgResponseTime += run.response.usage.completion_ms;
      }
    });

    return {
      uniqueModels: Array.from(models),
      totalTokens,
      totalCalls,
      totalSessions,
      avgResponseTime: totalCalls > 0 ? avgResponseTime / totalCalls : 0
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
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.avgResponseTime)}ms
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
                  <SelectItem value="response_time">Average Response Time</SelectItem>
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
                margin={{ top: 20, right: 20, left: 35, bottom: 0 }}
              >
                <XAxis 
                  dataKey="timestamp"
                  padding={{ right: 10 }}
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
                />
                <Tooltip
                  labelFormatter={(timestamp) => {
                    const date = new Date(timestamp);
                    return date.toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }}
                  formatter={(value) => [value, selectedMetric === 'response_time' ? 'ms' : '']}
                  isAnimationActive={false}
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
                        className="flex items-center justify-between mb-1 cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                        onClick={() => toggleRun(runId)}
                      >
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-500">
                            {new Date(run.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                        <ChevronRight 
                          className={`w-4 h-4 text-gray-500 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
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
