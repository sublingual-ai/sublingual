import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Bot, User } from "lucide-react";
import { Message, LLMRun } from "@/types/logs";

interface LLMInteractionProps {
  run: LLMRun;
  defaultExpanded?: boolean;
  showHeader?: boolean;
}

const getPreviewText = (messages: Message[], response: string) => {
  if (messages.length === 0) return '';
  const lastMessage = messages[messages.length - 1].content;
  const preview = `${lastMessage} → ${response}`;
  return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
};

export function LLMInteraction({ run, defaultExpanded = false, showHeader = true }: LLMInteractionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
          <span>{getPreviewText(run.messages, run.response_texts[0])}</span>
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

          <div 
            className="flex items-start gap-2 p-3 rounded-lg bg-primary-50"
          >
            <Bot size={16} className="mt-1 text-primary-600 flex-shrink-0" />
            <div className="text-sm whitespace-pre-wrap overflow-x-auto">
              {run.response_texts[0]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 