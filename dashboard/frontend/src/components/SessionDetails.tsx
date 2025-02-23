import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Tag, Code, ChevronRight } from "lucide-react";
import { Message, StackInfo, LLMRun } from "@/types/logs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LLMInteraction } from "@/components/LLMInteraction";
import { LLMHeader } from "@/components/LLMHeader";

interface SessionDetailsProps {
  runs: LLMRun[];
}

interface ExpandedState {
  code: boolean;
  content: boolean;
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

  const toggleCode = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        code: !(prev[index]?.code ?? false),
      }
    }));
  };

  const toggleCollapse = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        content: !(prev[index]?.content ?? true),
      }
    }));
  };

  const getStackInfo = (run: LLMRun) => {
    // Handle both new stack_trace and old stack_info format
    if (run.stack_trace && run.stack_trace.length > 0) {
      return {
        filename: run.stack_trace[0].filename,
        lineno: run.stack_trace[0].lineno,
        frames: [...run.stack_trace].reverse() // Create a new array before reversing
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
        const isExpanded = expandedStates[index]?.content ?? true;

        return (
          <div
            key={index}
            className="relative pl-6 border-l-2 border-primary-200 last:border-l-0 pb-4 mb-4 last:mb-0 last:pb-0"
          >
            {/* Timeline dot */}
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary-200" />

            <div className="space-y-2">
              {/* Location and buttons */}
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                onClick={() => toggleCollapse(index)}
              >
                <div className="flex items-center space-x-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="text-sm font-medium text-gray-700 flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    {stackInfo.frames[stackInfo.frames.length - 1]?.filename}:
                    {stackInfo.frames[stackInfo.frames.length - 1]?.lineno}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCode(index);
                    }}
                    className={`p-1 rounded hover:bg-gray-100 ${expandedStates[index]?.code ? 'text-primary-600' : 'text-gray-400'}`}
                    title="View call stack"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <>
                  <div className="mt-2">
                    <LLMHeader run={run} />
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
                  <div className="space-y-2">
                    <LLMInteraction run={run} />
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