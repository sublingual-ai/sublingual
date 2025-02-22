import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Tag, Code } from "lucide-react";
import { Message, StackInfo, LLMRun } from "@/types/logs";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SessionDetailsProps {
  runs: LLMRun[];
}

interface ExpandedState {
  messages: boolean;
  code: boolean;
}

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

export const SessionDetails = ({ runs }: SessionDetailsProps) => {
  const [expandedStates, setExpandedStates] = useState<Record<number, ExpandedState>>({});
  const [fullTextContent, setFullTextContent] = useState<string | null>(null);

  const toggleMessages = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: {
        messages: !(prev[index]?.messages ?? false),
        code: prev[index]?.code ?? false
      }
    }));
  };

  const toggleCode = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: {
        messages: prev[index]?.messages ?? false,
        code: !(prev[index]?.code ?? false)
      }
    }));
  };

  const toggleContent = (text: string) => {
    setFullTextContent(text);
  };

  const getStackInfo = (run: LLMRun) => {
    // Handle both new stack_trace and old stack_info format
    if (run.stack_trace && run.stack_trace.length > 0) {
      return {
        filename: run.stack_trace[0].filename,
        lineno: run.stack_trace[0].lineno,
        frames: run.stack_trace.reverse() // Reverse to show root caller first
      };
    } else if (run.stack_info) {
      return {
        filename: run.stack_info.filename,
        lineno: run.stack_info.lineno,
        frames: [{
          filename: run.stack_info.filename,
          lineno: run.stack_info.lineno,
          code_context: run.stack_info.code_context,
          function: run.stack_info.caller_function_name
        }]
      };
    }
    return {
      filename: 'unknown',
      lineno: 0,
      frames: []
    };
  };

  return (
    <div className="space-y-4 p-4">
      {runs.map((run, index) => {
        const stackInfo = getStackInfo(run);
        
        return (
          <div 
            key={index}
            className="relative pl-6 border-l-2 border-primary-200 last:border-l-0 pb-4 mb-4 last:mb-0 last:pb-0"
          >
            {/* Timeline dot */}
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary-200" />
            
            <div className="space-y-2">
              {/* Location and buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-medium text-gray-700 flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    {stackInfo.frames[stackInfo.frames.length - 1]?.filename}:
                    {stackInfo.frames[stackInfo.frames.length - 1]?.lineno}
                  </div>
                  <button
                    onClick={() => toggleCode(index)}
                    className={`p-1 rounded hover:bg-gray-100 ${expandedStates[index]?.code ? 'text-primary-600' : 'text-gray-400'}`}
                    title="View call stack"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => toggleMessages(index)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {expandedStates[index]?.messages ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Timestamp, model, and tokens */}
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                <span>{new Date(run.timestamp * 1000).toLocaleString()}</span>
                <span>•</span>
                <Badge variant="outline" className="text-xs text-primary-700">
                  {run.response.model}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
                  {run.response.usage.total_tokens} tokens
                </Badge>
              </div>

              {/* Stack trace (if expanded) */}
              {expandedStates[index]?.code && (
                <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded-md mb-2">
                  <div className="font-medium mb-2 text-gray-700">Call Stack:</div>
                  {stackInfo.frames.map((frame, frameIndex) => (
                    <div 
                      key={frameIndex} 
                      className={`mb-4 last:mb-0 pl-4 ${frameIndex > 0 ? 'border-l-2 border-gray-200' : ''}`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                        <div className="font-medium text-gray-600">
                          {frame.function} in {frame.filename}:{frame.lineno}
                        </div>
                      </div>
                      <div className="font-mono whitespace-pre overflow-x-auto border border-gray-200 rounded bg-white p-2 ml-4">
                        {frame.code_context.map((line, i) => (
                          <div 
                            key={i}
                            className={i === Math.floor(frame.code_context.length / 2) ? 'bg-green-100' : ''}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages (collapsed or expanded) */}
              {!expandedStates[index]?.messages ? (
                <div 
                  className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleMessages(index)}
                >
                  {getPreviewText(run.messages, run.response_texts[0])}
                </div>
              ) : (
                // Expanded view
                <>
                  {/* Messages */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-500 border-b border-gray-200 pb-2">
                      <button
                        onClick={() => toggleMessages(index)}
                        className="text-xs hover:text-gray-700 flex items-center space-x-1"
                      >
                        <ChevronUp className="w-3 h-3" />
                        <span>Collapse messages</span>
                      </button>
                    </div>
                    {run.messages.map((msg, msgIndex) => (
                      <div key={msgIndex}>
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {msg.role}:
                        </div>
                        <div 
                          className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleContent(msg.content)}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        response:
                      </div>
                      <div 
                        className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleContent(run.response_texts[0])}
                      >
                        {run.response_texts[0]}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

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