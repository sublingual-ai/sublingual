import { Badge } from "@/components/ui/badge";
import { Bot, User, Wrench, Calculator, Search, Database } from "lucide-react";
import { Message, LLMRun, ToolCall } from "@/types/logs";

interface LLMInteractionProps {
  run: LLMRun;
}

interface ToolCallArgs {
  [key: string]: any;
}

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

export function LLMInteraction({ run }: LLMInteractionProps) {
  const toolCalls = run.response.choices[0].message.tool_calls;
  const responseText = run.response_texts[0];

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {run.messages.map((msg, msgIndex) => (
          <div
            key={msgIndex}
            className={`flex flex-col p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-primary-50/50' : 'bg-gray-50'
              }`}
          >
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
              ) : (
                <>
                  <User size={16} className="text-gray-600 flex-shrink-0" />
                  <span className="text-xs text-gray-600">User</span>
                </>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap overflow-x-auto mt-2">
              {msg.content}
            </div>
          </div>
        ))}

        {toolCalls ? (
          toolCalls.map((toolCall, index) => (
            <ToolCallDisplay key={index} toolCall={toolCall} />
          ))
        ) : responseText && (
          <div className="flex flex-col p-3 rounded-lg bg-primary-50">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-primary-600 flex-shrink-0" />
              <span className="text-xs text-primary-600">Response</span>
            </div>
            <div className="text-sm whitespace-pre-wrap overflow-x-auto mt-2">
              {responseText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 