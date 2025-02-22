import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";
import { SessionsList } from "@/components/SessionsList";
import { Button } from "@/components/ui/button";
import { ListTree, GitBranch } from "lucide-react";
import { LogFileProvider } from "@/contexts/LogFileContext";

export default function Index() {
  const [view, setView] = useState<'runs' | 'sessions'>('runs');

  return (
    <LogFileProvider>
      <DashboardLayout>
        <div className="h-full flex flex-col">
          <div className="mb-4 flex justify-end space-x-2">
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
          
          {view === 'runs' ? <RunsList /> : <SessionsList />}
        </div>
      </DashboardLayout>
    </LogFileProvider>
  );
}
