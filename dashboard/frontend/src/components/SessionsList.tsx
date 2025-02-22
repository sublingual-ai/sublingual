import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronUp, Hash } from "lucide-react";
import { useLogFile } from "@/contexts/LogFileContext";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import React from "react";
import { SessionDetails } from "@/components/SessionDetails";
import { LLMRun, SessionRow } from "@/types/logs";

export const SessionsList = () => {
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedFile } = useLogFile();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFile) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:5360/get_log?filename=${selectedFile}`);
        if (!res.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data: LLMRun[] = await res.json();
        
        // Group runs by session_id, treating null/undefined sessions as individual items
        const sessionRows = data.reduce((acc: SessionRow[], run) => {
          if (!run.session_id) {
            // Create individual session for runs without session_id
            // Generate unique ID using timestamp and random suffix
            const uniqueId = `single-${run.timestamp}-${Math.random().toString(36).substr(2, 5)}`;
            acc.push({
              sessionId: uniqueId,
              runs: [run],
              callCount: 1,
              firstCall: run.timestamp,
              lastCall: run.timestamp,
              totalTokens: run.response.usage.total_tokens
            });
          } else {
            // Find or create session group
            let sessionGroup = acc.find(s => s.sessionId === run.session_id);
            if (!sessionGroup) {
              sessionGroup = {
                sessionId: run.session_id,
                runs: [],
                callCount: 0,
                firstCall: run.timestamp,
                lastCall: run.timestamp,
                totalTokens: 0
              };
              acc.push(sessionGroup);
            }
            sessionGroup.runs.push(run);
            sessionGroup.callCount++;
            sessionGroup.firstCall = Math.min(sessionGroup.firstCall, run.timestamp);
            sessionGroup.lastCall = Math.max(sessionGroup.lastCall, run.timestamp);
            sessionGroup.totalTokens += run.response.usage.total_tokens;
          }
          return acc;
        }, []);

        // Sort sessions by timestamp
        sessionRows.sort((a, b) => b.lastCall - a.lastCall);

        setSessions(sessionRows);
      } catch (error) {
        console.error('Error fetching logs:', error);
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedFile]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const filteredSessions = sessions.filter(session =>
    session.runs.some(run =>
      run.messages.some(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      ) || run.response_texts.some(text =>
        text.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search in sessions..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-8 h-8 text-primary-500" />
        </div>
      ) : filteredSessions.length > 0 ? (
        <ScrollArea className="flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-2 font-medium text-left">Session</th>
                <th className="px-4 py-2 font-medium text-left">Calls</th>
                <th className="px-4 py-2 font-medium text-left">First Call</th>
                <th className="px-4 py-2 font-medium text-left">Last Call</th>
                <th className="px-4 py-2 font-medium text-left">Total Tokens</th>
                <th className="px-4 py-2 font-medium text-left w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSessions.map((session) => [
                <tr 
                  key={`${session.sessionId}-row`}
                  className={`group hover:bg-gray-50 cursor-pointer ${
                    expandedSessions.includes(session.sessionId) ? 'bg-gray-50' : ''
                  }`}
                  onClick={() => toggleSession(session.sessionId)}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center space-x-2">
                      {expandedSessions.includes(session.sessionId) ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                      <Hash className="w-4 h-4" />
                      <span className="text-sm font-medium text-gray-700">
                        {session.runs.length === 1 && !session.runs[0].session_id
                          ? `Single Call (${session.sessionId})`
                          : session.sessionId}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {session.callCount} calls
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(session.firstCall * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(session.lastCall * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
                      {session.totalTokens} tokens
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    <div className="invisible group-hover:visible">
                      {expandedSessions.includes(session.sessionId) ? '↑' : '↓'}
                    </div>
                  </td>
                </tr>,
                expandedSessions.includes(session.sessionId) && (
                  <tr key={`${session.sessionId}-details`}>
                    <td colSpan={6} className="px-4 py-2 bg-gray-50">
                      <SessionDetails runs={session.runs} />
                    </td>
                  </tr>
                )
              ])}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No sessions found
        </div>
      )}
    </div>
  );
}; 