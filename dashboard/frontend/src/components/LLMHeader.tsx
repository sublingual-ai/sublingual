import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import { LLMRun } from "@/types/logs";

interface LLMHeaderProps {
  run: LLMRun;
}

export function LLMHeader({ run }: LLMHeaderProps) {
  const toolCalls = run.response.choices[0].message.tool_calls;
  
  return (
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
    </div>
  );
} 