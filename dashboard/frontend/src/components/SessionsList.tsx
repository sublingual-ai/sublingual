import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronRight, Hash } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { SessionDetails } from "@/components/SessionDetails";
import { LLMRun, SessionRow } from "@/types/logs";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingState } from "@/components/ui/loading-state";
import { runContainsText } from "@/utils/filterUtils";
import { groupRunsIntoSessions } from '@/utils/sessionUtils';

interface SessionsListProps {
  runs: LLMRun[];
}

export const SessionsList = ({ runs }: SessionsListProps) => {
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const sessions = useMemo(() => groupRunsIntoSessions(runs), [runs]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const filteredSessions = sessions.filter(session =>
    session.runs.some(run => runContainsText(run, searchTerm))
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        <div className="mt-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search in sessions..."
          />
        </div>
      </div>

      <LoadingState 
        isLoading={false}
        isEmpty={filteredSessions.length === 0}
        emptyMessage="No sessions found"
      />

      {filteredSessions.length > 0 ? (
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
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
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