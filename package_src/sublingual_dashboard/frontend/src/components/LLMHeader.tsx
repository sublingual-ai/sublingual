import { Badge } from "@/components/ui/badge";
import { Wrench, Settings2 } from "lucide-react";
import { LLMRun } from "@/types/logs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LLMHeaderProps {
  run: LLMRun;
}

export function LLMHeader({ run }: LLMHeaderProps) {
  const [showParams, setShowParams] = useState(false);
  const toolCalls = run.response.choices[0].message.tool_calls;

  return (
    <>
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="text-xs text-primary-700">
          {run.response.model}
        </Badge>
        <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
          {run.response.usage.total_tokens} tokens
        </Badge>
        <Badge variant="secondary" className="text-xs bg-primary-50 text-primary-700">
          n: {run.call_parameters.n}
        </Badge>
        {toolCalls && (
          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
            <Wrench size={12} className="mr-1 inline" />
            Tool Call
          </Badge>
        )}
        <Badge
          variant="secondary"
          className="text-xs bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowParams(true);
          }}
        >
          <Settings2 size={12} className="mr-1 inline" />
          All Parameters
        </Badge>
      </div>

      <Dialog open={showParams} onOpenChange={setShowParams}>
        <DialogContent className="max-w-lg max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
          <ScrollArea className="mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Model Parameters</h3>
                <div className="space-y-3">
                  {Object.entries(run.call_parameters).map(([key, value]) => (
                    <div key={key} className="flex items-start space-x-3 text-sm">
                      <div className="font-medium text-gray-500 min-w-[120px]">{key}</div>
                      <div className="text-gray-900">
                        {typeof value === 'boolean' 
                          ? (value ? 'Yes' : 'No')
                          : value === null || value === undefined 
                          ? '-' 
                          : String(value)
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Extra Parameters</h3>
                <div className="space-y-3">
                  {Object.entries(run.extra_info).map(([key, value]) => (
                    <div key={key} className="flex items-start space-x-3 text-sm">
                      <div className="font-medium text-gray-500 min-w-[120px]">{key}</div>
                      <div className="text-gray-900">
                        {typeof value === 'boolean'
                          ? (value ? 'Yes' : 'No')
                          : value === null || value === undefined
                          ? '-'
                          : String(value)
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
} 