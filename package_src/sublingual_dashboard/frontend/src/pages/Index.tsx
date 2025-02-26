import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";
import { SessionsList } from "@/components/SessionsList";
import { CallHierarchy } from "@/components/CallHierarchy";
import { Button } from "@/components/ui/button";
import { ListTree, GitBranch, Network, Hash, BarChart } from "lucide-react";
import { LogFileProvider, useLogFile } from "@/contexts/LogFileContext";
import { LLMRun, SessionRow } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MetricsView } from "@/components/MetricsView";
import { useLogs } from '@/hooks/useLogs';
import { DashboardView } from "@/components/DashboardView";
import { LayoutDashboard } from "lucide-react";

type ViewType = 'runs' | 'sessions' | 'trace' | 'metrics' | 'dashboard';

const Dashboard = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('selectedView');
    return (savedView as ViewType) || 'dashboard';
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { selectedFile } = useLogFile();
  const { runs, sessions, isLoading } = useLogs(selectedFile);

  useEffect(() => {
    localStorage.setItem('selectedView', view);
  }, [view]);

  useEffect(() => {
    if (view === 'trace' && !selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].sessionId);
    }
  }, [view, sessions, selectedSessionId]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 mb-4 flex justify-end space-x-2">
        <Button
          variant={view === 'dashboard' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('dashboard')}
        >
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
          <Button
            variant={view === 'metrics' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('metrics')}
          >
            <BarChart className="w-4 h-4 mr-2" />
            Metrics View
          </Button>
          <Button
            variant={view === 'sessions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('sessions')}
          >
            <GitBranch className="w-4 h-4 mr-2" />
            Sessions View
          </Button>
          <Button
            variant={view === 'trace' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('trace');
              // Select first session if none selected
              if (!selectedSessionId && sessions.length > 0) {
                setSelectedSessionId(sessions[0].sessionId);
              }
            }}
          >
            <Network className="w-4 h-4 mr-2" />
            Trace View
          </Button>
        </div>
        
        <div className="flex-1 min-h-0">
          {view === 'dashboard' && <DashboardView runs={runs} />}
          {view === 'runs' && <RunsList runs={runs}  />}
          {view === 'sessions' && <SessionsList runs={runs} />}
          {view === 'metrics' && <MetricsView runs={runs} />}
          {view === 'trace' && (
            <div className="flex h-full gap-4">
              {sessions.length > 0 ? (
                <>
                  <div className="flex-1">
                    <CallHierarchy 
                      runs={runs} 
                      selectedSessionId={selectedSessionId || sessions[0].sessionId} 
                    />
                  </div>
                  
                  <div className="w-64 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="text-sm font-medium text-gray-700">Sessions</h3>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-2">
                        {sessions.map(session => (
                          <button
                            key={session.sessionId}
                            className={`w-full text-left mt-1 px-3 py-2 rounded-md transition-colors ${
                              selectedSessionId === session.sessionId 
                                ? 'bg-primary-50 text-primary-900' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedSessionId(session.sessionId)}
                          >
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {session.runs.length === 1 && !session.runs[0].session_id
                                  ? `Single Call ${session.sessionId.slice(0, 8)}...`
                                  : `Session ${session.sessionId}`}
                              </span>
                            </div>
                            <div className="mt-1 flex gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {session.callCount} calls
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {session.totalTokens} tokens
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  No sessions available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default function Index() {
  return (
    <LogFileProvider>
      <Dashboard />
    </LogFileProvider>
  );
}
