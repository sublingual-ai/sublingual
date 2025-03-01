import { Badge } from "@/components/ui/badge";
import { Bot, User, Wrench, Code2 } from "lucide-react";
import { Message, LLMRun, ToolCall } from "@/types/logs";
import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { parseGrammarFormat, GrammarNode } from "@/utils/grammarParser";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GrammarTree } from "@/components/GrammarTree";
import { formatElapsedTime } from "@/utils/format";
import { formatTimestamp } from "@/utils/metrics";
import ErrorBoundary from './ErrorBoundary';

interface LLMInteractionProps {
  run: LLMRun | null;
}

interface FullMessagePopupProps {
  content: string | any | null;
  onClose: () => void;
}

const FullMessagePopup = ({ content, onClose }: FullMessagePopupProps) => {
  if (content === null) return null;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 flex flex-col"
        style={{ height: 'calc(100vh - 100px)' }}
        onClick={e => e.stopPropagation()}
      >
        <VisuallyHidden>
          <h2>Full Message Content</h2>
        </VisuallyHidden>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Full Message</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              {typeof content === 'string' ? (
                <div className="whitespace-pre-wrap text-sm text-gray-900">{content}</div>
              ) : (
                <pre className="text-sm text-gray-900">
                  {JSON.stringify(content, null, 2)}
                </pre>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

const MESSAGE_TRUNCATE_LENGTH = 500;

// Move truncateContent to be a proper React component
const TruncatedContent = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (content.length <= MESSAGE_TRUNCATE_LENGTH) return <>{content}</>;

  const halfLength = Math.floor(MESSAGE_TRUNCATE_LENGTH / 2);
  const start = content.slice(0, halfLength);
  const end = content.slice(-halfLength);

  if (isExpanded) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(false);
        }}
        className="cursor-pointer group"
      >
        <span>{content}</span>
        <div className="my-3 text-primary-400 font-medium text-sm group-hover:text-primary-600">
          Click to collapse message
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(true);
      }}
      className="cursor-pointer group"
    >
      <span>{start}</span>
      <div className="my-3 text-primary-400 font-medium text-sm group-hover:text-primary-600">
        Click to see full message
      </div>
      <span>{end}</span>
    </div>
  );
};

const ObjectDisplay = ({ data }: { data: any }) => {
  const renderValue = (value: any): JSX.Element => {
    if (value === null) return <span className="text-gray-400">null</span>;
    if (value === undefined) return <span className="text-gray-400">undefined</span>;
    if (typeof value === 'boolean') return <span className="text-blue-600">{value.toString()}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>;
    if (typeof value === 'string') return <span className="text-green-600">"{value}"</span>;
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">[]</span>;
      return (
        <div className="pl-4">
          [
          <div className="pl-4">
            {value.map((item, i) => (
              <div key={i}>
                {renderValue(item)}
                {i < value.length - 1 && ","}
              </div>
            ))}
          </div>
          ]
        </div>
      );
    }
    if (typeof value === 'object') {
      return <ObjectTree data={value} />;
    }
    return <span>{String(value)}</span>;
  };

  return renderValue(data);
};

const ObjectTree = ({ data }: { data: Record<string, any> }) => {
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-gray-400">{"{}"}</span>;
  }

  return (
    <div className="pl-4">
      {"{"}
      <div className="pl-4">
        {Object.entries(data).map(([key, value], i) => (
          <div key={key}>
            <span className="text-blue-700 font-medium">{key}</span>
            <span className="text-gray-400">: </span>
            <ObjectDisplay data={value} />
            {i < Object.keys(data).length - 1 && ","}
          </div>
        ))}
      </div>
      {"}"}
    </div>
  );
};

const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCall }) => {
  const args = JSON.parse(toolCall.function.arguments);

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50">
      <Wrench size={16} className="mt-1 text-blue-600 flex-shrink-0" />
      <div className="space-y-1">
        <div className="text-sm font-medium text-blue-700">
          {toolCall.function.name}
        </div>
        <div className="font-mono text-sm">
          <ObjectTree data={args} />
        </div>
      </div>
    </div>
  );
};

// Add helper function to check grammar validity
const isValidGrammar = (grammarResult: any) => {
  return grammarResult?.content &&
    typeof grammarResult.content === 'object' &&
    ['Format', 'Literal', 'Var', 'InferredVar', 'Concat'].includes(grammarResult.content.type);
};

export function LLMInteraction({ run }: LLMInteractionProps) {
  const [grammarTrees, setGrammarTrees] = useState<Record<number, GrammarNode>>({});
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [formatStrings, setFormatStrings] = useState<Record<number, string>>({});

  if (!run) return null;

  const handleShowGrammar = (msgIndex: number) => {
    if (run.grammar_result?.[msgIndex]) {
      if (grammarTrees[msgIndex]) {
        setGrammarTrees(prev => {
          const newTrees = { ...prev };
          delete newTrees[msgIndex];
          return newTrees;
        });
        return;
      }

      const grammarResult = run.grammar_result[msgIndex];
      if (grammarResult.content) {
        const tree = parseGrammarFormat(grammarResult.content);
        setGrammarTrees(prev => ({
          ...prev,
          [msgIndex]: tree
        }));

        if (grammarResult.content.type === 'Format' && grammarResult.content.type === 'Format') {
          setFormatStrings(prev => ({
            ...prev,
            [msgIndex]: grammarResult.content.base.value
          }));
        }
      }
    }
  };

  // Helper function to extract all tool calls for a message
  const getToolCalls = (msg: Message, msgIndex: number) => {
    // Tool calls directly in the message
    const messageToolCalls = msg.tool_calls || [];

    // Tool calls in the response - show them with the user message that triggered them
    const responseToolCalls = msg.role === 'user' && msgIndex === run.messages.length - 1
      ? (run.response?.choices?.[0]?.message?.tool_calls || [])
      : [];

    return [...messageToolCalls, ...responseToolCalls];
  };

  // Update renderContent to use the new component
  const renderContent = (content: any, msg: Message) => {
    if (!content) return null;

    if (Array.isArray(content)) {
      return content.map((block, index) => {
        if (block.type === 'text') {
          return (
            <div key={index}>
              {block.text && <TruncatedContent content={block.text} />}
            </div>
          );
        } else if (block.type === 'image_url') {
          return (
            <div key={index} className="mt-2 p-2 bg-gray-100 rounded text-gray-600 text-sm">
              [Image content]
            </div>
          );
        } else {
          // For other types of blocks, display as formatted JSON
          return (
            <div key={index} className="font-mono text-sm">
              <ObjectTree data={block} />
            </div>
          );
        }
      });
    }

    // If content is a string
    if (typeof content === 'string') {
      return (
        <div>
          <TruncatedContent content={content} />
        </div>
      );
    }

    // If content is an object
    if (typeof content === 'object' && content !== null) {
      return (
        <div className="font-mono text-sm">
          <ObjectTree data={content} />
        </div>
      );
    }

    // Fallback for other types
    return <div>{String(content)}</div>;
  };

  return (
    <ErrorBoundary>
      <div className="space-y-2 relative">
        {selectedContent && (
          <FullMessagePopup
            content={selectedContent}
            onClose={() => setSelectedContent(null)}
          />
        )}
        <div className="space-y-2">
          {run.messages?.map((msg, msgIndex) => {
            const allToolCalls = getToolCalls(msg, msgIndex);
            const isLastMessage = msgIndex === run.messages.length - 1;
            const hasResponse = isLastMessage && (run.response?.choices?.[0]?.message?.tool_calls?.length > 0 || run.response_texts?.length > 0);

            return (
              <React.Fragment key={msgIndex}>
                <div className={`flex flex-col p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-primary-50/50' : 'bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      {msg.role === 'assistant' ? (
                        <>
                          <Bot size={16} className="text-primary-600 flex-shrink-0" />
                          <span className="text-xs text-primary-600">Assistant</span>
                        </>
                      ) : msg.role === 'system' ? (
                        <>
                          <Wrench size={16} className="text-gray-600 flex-shrink-0" />
                          <span className="text-xs text-gray-600">System</span>
                        </>
                      ) : msg.role === 'tool' ? (
                        <>
                          <Wrench size={16} className="text-blue-600 flex-shrink-0" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-600">Tool</span>
                            {msg.tool_call_id && (
                              <Badge variant="outline" className="text-xs">
                                ID: {msg.tool_call_id}
                              </Badge>
                            )}
                          </div>
                        </>
                      ) : msg.role === 'user' ? (
                        <>
                          <User size={16} className="text-gray-600 flex-shrink-0" />
                          <span className="text-xs text-gray-600">User</span>
                        </>
                      ) : (
                        <>
                          <User size={16} className="text-gray-600 flex-shrink-0" />
                          <span className="text-xs text-gray-600">{msg.role}</span>
                        </>
                      )}

                      {/* Add duration_ms display for the last message */}
                      {isLastMessage && run.duration_ms && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-600">
                            {formatElapsedTime(run.duration_ms)}
                          </span>
                        </>
                      )}
                    </div>

                    {run.grammar_result?.[msgIndex] &&
                      isValidGrammar(run.grammar_result[msgIndex]) && (
                        <Button
                          variant={grammarTrees[msgIndex] ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleShowGrammar(msgIndex)}
                        >
                          <Code2 size={14} className="mr-1" />
                          <span className="text-xs">
                            {grammarTrees[msgIndex] ? "Hide Prompt Template" : "Show Prompt Template"}
                          </span>
                        </Button>
                      )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words mt-2">
                    {grammarTrees[msgIndex] ? (
                      <>
                        {formatStrings[msgIndex] && (
                          <div className="mb-3 p-3 bg-blue-50 rounded-md">
                            <div className="text-xs font-medium text-blue-700 mb-1">Format String:</div>
                            <div className="font-mono text-sm whitespace-pre-wrap">{formatStrings[msgIndex]}</div>
                          </div>
                        )}
                        <GrammarTree node={grammarTrees[msgIndex]} />
                      </>
                    ) : (
                      renderContent(msg.content, msg)
                    )}
                  </div>
                </div>

                {/* Show tool calls from the message itself */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="ml-6 space-y-2">
                    {msg.tool_calls.map((toolCall, index) => (
                      <div key={index}>
                        <Badge variant="outline" className="mb-2">
                          {msg.role === 'assistant' ? 'Assistant Tool Call' : 'Tool Call'} [{index + 1}]
                        </Badge>
                        <ToolCallDisplay toolCall={toolCall} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Show response box with tool calls and/or response texts */}
                {hasResponse && (
                  <>
                    {/* Response box for response texts */}
                    {run.response_texts && run.response_texts.length > 0 && (
                      <div className="flex flex-col p-3 rounded-lg bg-primary-50">
                        <div className="flex items-center gap-2">
                          <Bot size={16} className="text-primary-600 flex-shrink-0" />
                          <span className="text-xs text-primary-600">Response</span>
                        </div>

                        {/* Show response texts */}
                        {run.response_texts.map((responseText, index) => (
                          <div
                            key={index}
                            className={`text-sm whitespace-pre-wrap break-words mt-2 ${responseText?.length > MESSAGE_TRUNCATE_LENGTH ? 'cursor-pointer' : ''
                              }`}
                            onClick={() => responseText?.length > MESSAGE_TRUNCATE_LENGTH && setSelectedContent(responseText)}
                          >
                            {responseText && <TruncatedContent content={responseText} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Show tool calls from the response */}
                    {run.response?.choices?.[0]?.message?.tool_calls && (
                      <div className="ml-6 space-y-2">
                        {run.response.choices[0].message.tool_calls.map((toolCall, index) => (
                          <div key={index}>
                            <Badge variant="outline" className="mb-2">
                              Response Tool Call [{index + 1}]
                            </Badge>
                            <ToolCallDisplay toolCall={toolCall} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </ErrorBoundary>
  );
} 