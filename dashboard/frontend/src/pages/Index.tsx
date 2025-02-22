import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";
import { SessionsList } from "@/components/SessionsList";
import { CallHierarchy } from "@/components/CallHierarchy";
import { Button } from "@/components/ui/button";
import { ListTree, GitBranch, Network, Hash } from "lucide-react";
import { LogFileProvider, useLogFile } from "@/contexts/LogFileContext";
import { LLMRun, SessionRow } from "@/types/logs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type ViewType = 'runs' | 'sessions' | 'trace';

const Dashboard = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('selectedView');
    return (savedView as ViewType) || 'runs';
  });
  const [runs, setRuns] = useState<LLMRun[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { selectedFile } = useLogFile();

  useEffect(() => {
    localStorage.setItem('selectedView', view);
  }, [view]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFile) return;
      
      try {
        const res = await fetch(`http://localhost:5360/get_log?filename=${selectedFile}`);
        if (!res.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data: LLMRun[] = await res.json();
        setRuns(data);

        // Group runs by session_id and create SessionRows
        const groupedSessions = data.reduce((acc, run) => {
          const sessionId = run.session_id || 'unassigned';
          if (!acc[sessionId]) {
            acc[sessionId] = [];
          }
          acc[sessionId].push(run);
          return acc;
        }, {} as Record<string, LLMRun[]>);

        // Convert to SessionRow array
        const sessionRows = Object.entries(groupedSessions).map(([sessionId, runs]) => ({
          sessionId,
          runs: runs.sort((a, b) => a.timestamp - b.timestamp),
          callCount: runs.length,
          firstCall: runs[0].timestamp,
          lastCall: runs[runs.length - 1].timestamp,
          totalTokens: runs.reduce((sum, run) => sum + run.response.usage.total_tokens, 0)
        }));

        setSessions(sessionRows);
      } catch (error) {
        console.error('Error fetching logs:', error);
        setRuns([]);
        setSessions([]);
      }
    };

    fetchData();
  }, [selectedFile]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 mb-4 flex justify-end space-x-2">
          <Button
            variant={view === 'runs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('runs')}
          >
            <ListTree className="w-4 h-4 mr-2" />
            Runs View
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
          {view === 'runs' && <RunsList />}
          {view === 'sessions' && <SessionsList />}
          {view === 'trace' && selectedSessionId && (
            <div className="flex h-full gap-4">
              <div className="flex-1">
                <CallHierarchy 
                  runs={runs} 
                  selectedSessionId={selectedSessionId} 
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
                            {session.sessionId === 'unassigned' ? 'Unassigned' : `Session ${session.sessionId}`}
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
