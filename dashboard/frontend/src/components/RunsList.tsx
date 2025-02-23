import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronUp, Tag, Users, Hash } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLogFile } from "@/contexts/LogFileContext";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Message, StackInfo, LLMRun } from "@/types/logs";
import { LLMInteraction } from "@/components/LLMInteraction";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingState } from "@/components/ui/loading-state";
import { runContainsText } from "@/utils/filterUtils";
import { LLMHeader } from "@/components/LLMHeader";
import { API_BASE_URL } from '@/config';

const CodePopup = ({
  stackInfo,
  isVisible,
  position,
  onClose
}: {
  stackInfo: StackInfo;
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && popupRef.current) {
      const popup = popupRef.current;

      popup.style.visibility = 'hidden';
      popup.style.transform = 'none';
      popup.style.left = '0';
      popup.style.top = '0';

      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = position.x - (rect.width / 2);
      let top = position.y + 20;

      if (left + rect.width > viewportWidth - 20) {
        left = viewportWidth - rect.width - 20;
      }
      if (left < 20) {
        left = 20;
      }

      if (top + rect.height > viewportHeight - 20) {
        top = position.y - rect.height - 10;
      }

      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
      popup.style.visibility = 'visible';
    }
  }, [isVisible, position]);

  if (!isVisible) return null;

  // Calculate line numbers and find target line index
  const codeLines = 'code_context' in stackInfo ? stackInfo.code_context : [];
  const targetLineIndex = Math.floor(codeLines.length / 2);

  return (
    <div
      ref={popupRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 max-w-lg popup-content"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs font-medium text-gray-700">
          {stackInfo.filename}:{stackInfo.lineno}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          ✕
        </button>
      </div>
      <pre className="bg-gray-50 p-2 rounded-md text-xs overflow-x-auto leading-4">
        <code>
          {codeLines.map((line, index) => (
            <div
              key={index}
              className={index === targetLineIndex ? 'bg-green-100' : ''}
            >
              {line}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};

const truncateText = (text: string) => {
  const maxLength = 300;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

const getPreviewText = (messages: Message[], response: string) => {
  if (messages.length === 0) return '';
  const lastMessage = messages[messages.length - 1].content;
  const preview = `${lastMessage} → ${response}`;
  return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
};

export const RunsList = () => {
  const { selectedFile } = useLogFile();
  const [runs, setRuns] = useState<LLMRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCallers, setSelectedCallers] = useState<string[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [popupInfo, setPopupInfo] = useState<{
    stackInfo: StackInfo;
    position: { x: number; y: number };
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fullTextContent, setFullTextContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFile) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/get_log?filename=${selectedFile}`);
        if (!res.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data: LLMRun[] = await res.json();
        setRuns(data.sort((a, b) => b.timestamp - a.timestamp)); // Sort by timestamp, newest first
      } catch (error) {
        console.error('Error fetching logs:', error);
        setRuns([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedFile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupInfo &&
        !(event.target as Element).closest('.popup-content') &&
        !(event.target as Element).closest('.caller-header')) {
        setPopupInfo(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popupInfo]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopupInfo(null);
        setFullTextContent(null);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // Simplified caller info function
  const getCallerInfo = (run: LLMRun) => {
    return run.stack_info || null;
  };

  // Get unique callers from all runs
  const allCallers = Array.from(new Set(runs
    .map(run => {
      const info = getCallerInfo(run);
      if (!info) return null;
      return `${info.filename}::${info.caller_function_name}():${info.lineno}`;
    })
    .filter((caller): caller is string => caller !== null)
  ));

  const toggleCaller = (caller: string) => {
    setSelectedCallers(prev =>
      prev.includes(caller)
        ? prev.filter(c => c !== caller)
        : [...prev, caller]
    );
  };

  // Update grouping logic
  const allGroupedRuns = runs.reduce((acc, run) => {
    const info = getCallerInfo(run);
    if (!info) return acc;
    
    const callerKey = `${info.filename}::${info.caller_function_name}():${info.lineno}`;
    if (!acc[callerKey]) {
      acc[callerKey] = [];
    }
    acc[callerKey].push(run);
    return acc;
  }, {} as Record<string, LLMRun[]>);

  // Then filter the groups based on search and selected callers
  const filteredGroupedRuns = Object.entries(allGroupedRuns).reduce((acc, [caller, runs]) => {
    const filteredRuns = runs.filter(run =>
      (run.messages.some(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      ) || run.response_texts.some(text =>
        text.toLowerCase().includes(searchTerm.toLowerCase())
      )) &&
      (selectedReqIds.length === 0 || selectedReqIds.includes(run.extra_info.req_id))
    );

    if (filteredRuns.length > 0 &&
      (selectedCallers.length === 0 || selectedCallers.includes(caller))) {
      acc[caller] = filteredRuns;
    }
    return acc;
  }, {} as Record<string, LLMRun[]>);

  const toggleGroup = (caller: string) => {
    setExpandedGroups(prev =>
      prev.includes(caller)
        ? prev.filter(c => c !== caller)
        : [...prev, caller]
    );
  };

  // Update expandedGroups effect
  useEffect(() => {
    const allCallers = runs
      .map(run => {
        const info = getCallerInfo(run);
        if (!info) return null;
        return `${info.filename}::${info.caller_function_name}():${info.lineno}`;
      })
      .filter((caller): caller is string => caller !== null);
    setExpandedGroups(Array.from(new Set(allCallers)));
  }, [runs]);

  // Update handleCallerClick
  const handleCallerClick = (run: LLMRun, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!run.stack_info) return;

    // Close popup if clicking the same caller
    if (popupInfo &&
      popupInfo.stackInfo.filename === run.stack_info.filename &&
      popupInfo.stackInfo.lineno === run.stack_info.lineno) {
      setPopupInfo(null);
      return;
    }

    // Open popup for new caller
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupInfo({
      stackInfo: run.stack_info,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    });
  };

  const handleReqIdClick = (reqId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedReqIds(prev => [...prev, reqId]);
    setExpandedRuns([]);
  };

  const removeReqIdFilter = (reqId: string) => {
    setSelectedReqIds(prev => prev.filter(id => id !== reqId));
  };

  const toggleRun = (runId: string) => {
    setExpandedRuns(prev =>
      prev.includes(runId)
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  const filteredRuns = runs.filter(run => runContainsText(run, searchTerm));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">LLM Runs</h2>
        <div className="mt-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search in runs..."
          />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Files:
            </span>
            {allCallers.map(caller => (
              <Badge
                key={caller}
                variant="secondary"
                className={`cursor-pointer ${selectedCallers.includes(caller)
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-700"
                  }`}
                onClick={() => toggleCaller(caller)}
              >
                {caller.split('/').pop()}
              </Badge>
            ))}
          </div>

          {selectedReqIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <Hash className="w-4 h-4 mr-2" />
                Request IDs:
              </span>
              {selectedReqIds.map(reqId => (
                <Badge
                  key={reqId}
                  variant="secondary"
                  className={`cursor-pointer bg-primary-100 text-primary-700`}
                  onClick={() => removeReqIdFilter(reqId)}
                >
                  {reqId}
                  <span className="ml-1 hover:text-primary-900">×</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <LoadingState 
        isLoading={isLoading}
        isEmpty={filteredRuns.length === 0}
        emptyMessage="No runs found"
      />

      {filteredRuns.length > 0 ? (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-gray-100">
            {filteredRuns.map((run, index) => {
              const runId = `run-${index}`;
              const isExpanded = expandedRuns.includes(runId);

              return (
                <div key={runId} className="transition-colors">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRun(runId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                            {getPreviewText(run.messages, run.response_texts[0])}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          {run.stack_info && (
                            <Badge variant="outline" className="text-xs text-primary-700">
                              {run.stack_info.filename}:{run.stack_info.lineno}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <LLMHeader run={run} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(run.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <LLMInteraction run={run} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No runs found
        </div>
      )}

      <CodePopup
        stackInfo={popupInfo?.stackInfo!}
        isVisible={!!popupInfo}
        position={popupInfo?.position!}
        onClose={() => setPopupInfo(null)}
      />

      <Dialog open={!!fullTextContent} onOpenChange={() => setFullTextContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <div className="overflow-y-auto p-4">
            <pre className="whitespace-pre-wrap break-words text-sm">
              {fullTextContent}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
