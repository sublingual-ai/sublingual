import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronUp, Hash } from "lucide-react";
import { useLogFile } from "@/contexts/LogFileContext";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

interface Message {
  role: string;
  content: string;
}

interface LLMRun {
  session_id: string | null;
  messages: Message[];
  response_texts: string[];
  timestamp: number;
  response: {
    model: string;
    usage: {
      total_tokens: number;
    }
  };
}

export const SessionsList = () => {
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedFile } = useLogFile();
  const [sessions, setSessions] = useState<Record<string, LLMRun[]>>({});
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
        
        // Group runs by session_id
        const groupedSessions = data.reduce((acc, run) => {
          const sessionId = run.session_id || 'unassigned';
          if (!acc[sessionId]) {
            acc[sessionId] = [];
          }
          acc[sessionId].push(run);
          return acc;
        }, {} as Record<string, LLMRun[]>);

        // Sort runs within each session by timestamp
        Object.values(groupedSessions).forEach(runs => {
          runs.sort((a, b) => a.timestamp - b.timestamp);
        });

        setSessions(groupedSessions);
      } catch (error) {
        console.error('Error fetching logs:', error);
        setSessions({});
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

  const filteredSessions = Object.entries(sessions).filter(([sessionId, runs]) =>
    runs.some(run =>
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
          <div className="divide-y divide-gray-100">
            {filteredSessions.map(([sessionId, runs]) => (
              <div key={sessionId} className="border-b border-gray-200">
                <div
                  className="bg-gray-50 px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSession(sessionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4" />
                      <h3 className="text-sm font-medium text-gray-700">
                        {sessionId === 'unassigned' ? 'Unassigned Calls' : `Session ${sessionId}`}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {runs.length} calls
                      </Badge>
                    </div>
                    {expandedSessions.includes(sessionId) ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {expandedSessions.includes(sessionId) && (
                  <div className="px-4 py-2">
                    {runs.map((run, index) => (
                      <div
                        key={index}
                        className="mb-4 last:mb-0 p-3 bg-gray-50 rounded-md"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs text-primary-700">
                              {run.response.model}
                            </Badge>
                            <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
                              {run.response.usage.total_tokens} tokens
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(run.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {run.messages.map((msg, msgIndex) => (
                            <div key={msgIndex} className="text-sm">
                              <div className="font-medium text-gray-700">{msg.role}:</div>
                              <div className="mt-1 text-gray-600 bg-gray-100 p-2 rounded-md">
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          <div className="text-sm">
                            <div className="font-medium text-gray-700">Response:</div>
                            {run.response_texts.map((text, respIndex) => (
                              <div key={respIndex} className="mt-1 text-gray-600 bg-gray-100 p-2 rounded-md">
                                {text}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No sessions found
        </div>
      )}
    </div>
  );
}; 