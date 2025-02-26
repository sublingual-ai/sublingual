import { useState, useMemo } from "react";
import { LLMRun } from "@/types/logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Zap, Clock, Bot, Hash } from "lucide-react";

interface DashboardViewProps {
  runs: LLMRun[];
}

export function DashboardView({ runs }: DashboardViewProps) {
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
          <CardHeader>
            <CardTitle>Models Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.uniqueModels.map(model => (
                <Badge key={model} variant="secondary" className="text-sm">
                  <Bot className="w-3 h-3 mr-1" />
                  {model}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {recentRuns.map((run, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[300px]">
                        {run.messages[run.messages.length - 1]?.content || 'No content'}
                      </span>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {run.response.usage.total_tokens} tokens
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 