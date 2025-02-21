import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronUp, Tag, Users, Hash, Layers } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface Message {
  role: string;
  content: string;
}

interface StackInfo {
  filename: string;
  lineno: number;
  code_context: string[];
  caller_function_name: string;
}

interface LLMRun {
  messages: Message[];
  response_texts: string[];
  timestamp: number;
  response: {
    model: string;
    usage: {
      total_tokens: number;
    }
  };
  extra_info: {
    req_id: string;
  };
  stack_info: StackInfo;
  session_id: string;
}

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
  const codeLines = stackInfo.code_context;
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

export const RunsList = () => {
  const [runs, setRuns] = useState<LLMRun[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCallers, setSelectedCallers] = useState<string[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [popupInfo, setPopupInfo] = useState<{
    stackInfo: StackInfo;
    position: { x: number; y: number };
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'caller' | 'session'>('caller');

  useEffect(() => {
    fetch('http://localhost:5360/logs')
      .then(res => res.json())
      .then(data => setRuns(data));
  }, []);

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

  const handleCallerClick = (stackInfo: StackInfo, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Close popup if clicking the same caller
    if (popupInfo && 
        popupInfo.stackInfo.filename === stackInfo.filename && 
        popupInfo.stackInfo.lineno === stackInfo.lineno) {
      setPopupInfo(null);
      return;
    }

    // Open popup for new caller
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupInfo({
      stackInfo,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    });
  };

  const handleReqIdClick = (reqId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedReqIds(prev => [...prev, reqId]);
  };

  const removeReqIdFilter = (reqId: string) => {
    setSelectedReqIds(prev => prev.filter(id => id !== reqId));
  };

  // Get unique callers from all runs, now including line numbers
  const allCallers = Array.from(new Set(runs.map(run =>
    `${run.stack_info.filename}::${run.stack_info.caller_function_name}():${run.stack_info.lineno}`
  )));

  const toggleCaller = (caller: string) => {
    setSelectedCallers(prev =>
      prev.includes(caller)
        ? prev.filter(c => c !== caller)
        : [...prev, caller]
    );
  };

  // Modify the grouping logic to handle both caller and session grouping
  const allGroupedRuns = runs.reduce((acc, run) => {
    const groupKey = groupBy === 'caller' 
      ? `${run.stack_info.filename}::${run.stack_info.caller_function_name}():${run.stack_info.lineno}`
      : run.session_id || 'No Session';
    
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(run);
    return acc;
  }, {} as Record<string, LLMRun[]>);

  // Update the filtering logic
  const filteredGroupedRuns = Object.entries(allGroupedRuns).reduce((acc, [groupKey, runs]) => {
    const filteredRuns = runs.filter(run =>
      (run.messages.some(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      ) || run.response_texts.some(text =>
        text.toLowerCase().includes(searchTerm.toLowerCase())
      )) &&
      (selectedReqIds.length === 0 || selectedReqIds.includes(run.extra_info.req_id)) &&
      (groupBy === 'session' || selectedCallers.length === 0 || selectedCallers.includes(groupKey))
    );

    if (filteredRuns.length > 0 &&
      (groupBy === 'session' || selectedCallers.length === 0 || selectedCallers.includes(groupKey))) {
      acc[groupKey] = filteredRuns;
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

  // Update expandedGroups when runs change
  useEffect(() => {
    const allCallers = runs.map(run =>
      `${run.stack_info.filename}::${run.stack_info.caller_function_name}():${run.stack_info.lineno}`
    );
    setExpandedGroups(Array.from(new Set(allCallers)));
  }, [runs]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">LLM Runs</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setGroupBy('caller')}
              className={`px-3 py-1 rounded-md text-sm flex items-center gap-2 ${
                groupBy === 'caller' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Tag className="w-4 h-4" />
              Group by Caller
            </button>
            <button
              onClick={() => setGroupBy('session')}
              className={`px-3 py-1 rounded-md text-sm flex items-center gap-2 ${
                groupBy === 'session' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              Group by Session
            </button>
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search messages and responses..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          {groupBy === 'caller' && (
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
          )}
          
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
      <ScrollArea className="flex-1 overflow-auto">
        <div className="divide-y divide-gray-100">
          {Object.entries(filteredGroupedRuns).map(([groupKey, runs]) => (
            <div key={groupKey} className="border-b border-gray-200">
              <div
                className="bg-gray-50 px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleGroup(groupKey)}
              >
                <h3 className="text-sm font-medium text-gray-700 flex items-center justify-between">
                  <div className="flex items-center">
                    {groupBy === 'caller' ? (
                      <>
                        <Tag className="w-4 h-4 mr-2" />
                        <span 
                          className="hover:text-primary-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCallerClick(runs[0].stack_info, e);
                          }}
                        >
                          {groupKey}
                        </span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4 mr-2" />
                        <span>{groupKey}</span>
                      </>
                    )}
                  </div>
                  {expandedGroups.includes(groupKey) ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </h3>
              </div>
              <div
                className={`transition-all duration-200 ${
                  expandedGroups.includes(groupKey) ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
                }`}
              >
                {expandedGroups.includes(groupKey) && runs.map((run, index) => {
                  const entryId = `${groupKey}-${index}`;
                  return (
                    <div
                      key={entryId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === entryId ? null : entryId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                                {run.messages[run.messages.length - 1].content}
                              </h3>
                              {expandedId === entryId ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              {groupBy === 'session' && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs text-gray-600 cursor-pointer hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCallerClick(run.stack_info, e);
                                  }}
                                >
                                  <Tag className="w-3 h-3 mr-1 inline" />
                                  {`${run.stack_info.filename.split('/').pop()}:${run.stack_info.lineno}`}
                                </Badge>
                              )}
                              {run.extra_info.req_id && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs text-gray-600 cursor-pointer hover:bg-gray-100"
                                  onClick={(e) => handleReqIdClick(run.extra_info.req_id, e)}
                                >
                                  {run.extra_info.req_id}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs text-primary-700">
                                {run.response.model}
                              </Badge>
                              <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
                                {run.response.usage.total_tokens} tokens
                              </Badge>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(run.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {expandedId === entryId && (
                        <div className="px-4 pb-4">
                          <div className="space-y-3 text-sm">
                            {run.messages.map((msg, msgIndex) => (
                              <div key={msgIndex}>
                                <div className="font-medium text-gray-700">{msg.role}:</div>
                                <div className="mt-1 text-gray-600 bg-gray-50 p-3 rounded-md">
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            <div>
                              <div className="font-medium text-gray-700">Responses:</div>
                              {run.response_texts.map((text, respIndex) => (
                                <div key={respIndex} className="mt-1 text-gray-600 bg-gray-50 p-3 rounded-md">
                                  {text}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <CodePopup
        stackInfo={popupInfo?.stackInfo!}
        isVisible={!!popupInfo}
        position={popupInfo?.position!}
        onClose={() => setPopupInfo(null)}
      />
    </div>
  );
};
