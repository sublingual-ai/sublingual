import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Bot, User, Wrench, Calculator, Search, Database } from "lucide-react";
import { Message, LLMRun, ToolCall } from "@/types/logs";

interface LLMInteractionProps {
  run: LLMRun;
  defaultExpanded?: boolean;
  showHeader?: boolean;
}

interface ToolCallArgs {
  [key: string]: any;
}

const getPreviewText = (messages: Message[], response: string | null, toolCalls: ToolCall[] | undefined) => {
  if (messages.length === 0) return '';
  const lastMessage = messages[messages.length - 1].content;
  
  if (toolCalls && toolCalls.length > 0) {
    const toolCall = toolCalls[0];
    const args = JSON.parse(toolCall.function.arguments);
    const preview = `${lastMessage} → [${toolCall.function.name}(${JSON.stringify(args)})]`;
    return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
  }
  
  if (response) {
    const preview = `${lastMessage} → ${response}`;
    return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
  }
  
  return lastMessage;
};

const CalculatorDisplay = ({ args }: { args: ToolCallArgs }) => {
  const operation = args.operation;
  const numbers = args.numbers;
  
  const operationSymbols: Record<string, string> = {
    'add': '+',
    'subtract': '-',
    'multiply': '×',
    'divide': '÷',
  };

  return (
    <div className="text-sm font-mono bg-blue-100/50 px-3 py-2 rounded">
      {numbers.join(` ${operationSymbols[operation] || operation} `)}
    </div>
  );
};

const SearchDisplay = ({ args }: { args: ToolCallArgs }) => {
  return (
    <div className="text-sm bg-blue-100/50 px-3 py-2 rounded">
      <div className="font-medium mb-1">Search query:</div>
      <div className="font-mono">{args.query}</div>
    </div>
  );
};

const DatabaseDisplay = ({ args }: { args: ToolCallArgs }) => {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">
        {args.operation} operation on {args.table}
      </div>
      {args.fields && (
        <div className="text-sm bg-blue-100/50 px-3 py-2 rounded font-mono">
          {Array.isArray(args.fields) ? args.fields.join(', ') : args.fields}
        </div>
      )}
    </div>
  );
};

const DefaultDisplay = ({ args }: { args: ToolCallArgs }) => {
  return (
    <pre className="text-sm text-blue-600 bg-blue-100/50 p-2 rounded whitespace-pre-wrap">
      {JSON.stringify(args, null, 2)}
    </pre>
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
        <div className="pl-4 border-l border-blue-200">
          {value.map((item, i) => (
            <div key={i} className="text-gray-600">
              {renderValue(item)}
              {i < value.length - 1 && ","}
            </div>
          ))}
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
    <div className="pl-4 border-l border-blue-200">
      {Object.entries(data).map(([key, value], i) => (
        <div key={key} className="text-gray-600">
          <span className="text-blue-700 font-medium">{key}</span>
          <span className="text-gray-400">: </span>
          <ObjectDisplay data={value} />
          {i < Object.keys(data).length - 1 && ","}
        </div>
      ))}
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

export function LLMInteraction({ run, defaultExpanded = false, showHeader = true }: LLMInteractionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const toolCalls = run.response.choices[0].message.tool_calls;
  const responseText = run.response_texts[0];

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs text-primary-700">
            {run.response.model}
          </Badge>
          <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
            {run.response.usage.total_tokens} tokens
          </Badge>
          {toolCalls && (
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
              <Wrench size={12} className="mr-1 inline" />
              Tool Call
            </Badge>
          )}
          <span className="text-xs text-gray-500">
            {new Date(run.timestamp * 1000).toLocaleString()}
          </span>
        </div>
      )}

      {!isExpanded ? (
        <div 
          className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 cursor-pointer hover:bg-gray-100 flex items-center justify-between"
          onClick={() => setIsExpanded(true)}
        >
          <span>{getPreviewText(run.messages, responseText, toolCalls)}</span>
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
            >
              <ChevronUp className="w-3 h-3" />
              <span>Collapse</span>
            </button>
          </div>

          {run.messages.map((msg, msgIndex) => (
            <div 
              key={msgIndex}
              className={`flex items-start gap-2 p-3 rounded-lg ${
                msg.role === 'assistant' ? 'bg-primary-50/50' : 'bg-gray-50'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Bot size={16} className="mt-1 text-primary-600 flex-shrink-0" />
              ) : (
                <User size={16} className="mt-1 text-gray-600 flex-shrink-0" />
              )}
              <div className="text-sm whitespace-pre-wrap overflow-x-auto">
                {msg.content}
              </div>
            </div>
          ))}

          {toolCalls ? (
            toolCalls.map((toolCall, index) => (
              <ToolCallDisplay key={index} toolCall={toolCall} />
            ))
          ) : responseText && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-50">
              <Bot size={16} className="mt-1 text-primary-600 flex-shrink-0" />
              <div className="text-sm whitespace-pre-wrap overflow-x-auto">
                {responseText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 