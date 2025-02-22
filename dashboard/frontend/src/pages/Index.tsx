import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";
import { SessionsList } from "@/components/SessionsList";
import { Button } from "@/components/ui/button";
import { ListTree, GitBranch } from "lucide-react";
import { LogFileProvider } from "@/contexts/LogFileContext";

type ViewType = 'runs' | 'sessions';

export default function Index() {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('selectedView');
    return (savedView as ViewType) || 'runs';
  });

  useEffect(() => {
    localStorage.setItem('selectedView', view);
  }, [view]);

  return (
    <LogFileProvider>
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
          </div>
          
          <div className="flex-1 min-h-0">
            {view === 'runs' ? <RunsList /> : <SessionsList />}
          </div>
        </div>
      </DashboardLayout>
    </LogFileProvider>
  );
}
