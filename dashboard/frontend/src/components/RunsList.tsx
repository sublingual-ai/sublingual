
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronDown, ChevronUp, Tag, Users } from "lucide-react";
import { useState } from "react";

interface LLMRun {
  id: string;
  input: string;
  output: string;
  tags: string[];
  timestamp: string;
  model: string;
  caller: string;
}

const sampleRuns: LLMRun[] = [
  {
    id: "1",
    input: "Explain the concept of recursion in programming.",
    output: "Recursion is a programming concept where a function calls itself to solve a larger problem by breaking it down into smaller, similar sub-problems...",
    tags: ["technical", "explanation", "programming"],
    timestamp: "2024-03-20T10:30:00Z",
    model: "gpt-4o-mini",
    caller: "documentation-bot"
  },
  {
    id: "2",
    input: "Write a tweet about AI safety.",
    output: "As we advance in AI technology, establishing robust safety measures isn't just a priority—it's a necessity. We must ensure AI development aligns with human values and ethics. #AISafety #Ethics",
    tags: ["social", "AI", "safety"],
    timestamp: "2024-03-20T11:15:00Z",
    model: "gpt-4o",
    caller: "social-media-bot"
  },
];

export const RunsList = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCallers, setSelectedCallers] = useState<string[]>([]);

  // Get unique tags and callers from all runs
  const allTags = Array.from(new Set(sampleRuns.flatMap(run => run.tags)));
  const allCallers = Array.from(new Set(sampleRuns.map(run => run.caller)));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const toggleCaller = (caller: string) => {
    setSelectedCallers(prev =>
      prev.includes(caller)
        ? prev.filter(c => c !== caller)
        : [...prev, caller]
    );
  };

  const filteredRuns = sampleRuns.filter(run => {
    const matchesSearch = run.input.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         run.output.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.every(tag => run.tags.includes(tag));
    const matchesCaller = selectedCallers.length === 0 ||
                         selectedCallers.includes(run.caller);
    return matchesSearch && matchesTags && matchesCaller;
  });

  // Group runs by caller
  const groupedRuns = filteredRuns.reduce((acc, run) => {
    if (!acc[run.caller]) {
      acc[run.caller] = [];
    }
    acc[run.caller].push(run);
    return acc;
  }, {} as Record<string, LLMRun[]>);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-[calc(100vh-2rem)]">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">LLM Runs</h2>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search inputs and outputs..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Callers:
            </span>
            {allCallers.map(caller => (
              <Badge
                key={caller}
                variant="secondary"
                className={`cursor-pointer ${
                  selectedCallers.includes(caller)
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => toggleCaller(caller)}
              >
                {caller}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Tags:
            </span>
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className={`cursor-pointer ${
                  selectedTags.includes(tag)
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-340px)]">
        <div className="divide-y divide-gray-100">
          {Object.entries(groupedRuns).map(([caller, runs]) => (
            <div key={caller} className="border-b border-gray-200">
              <div className="bg-gray-50 px-4 py-2">
                <h3 className="text-sm font-medium text-gray-700">{caller}</h3>
              </div>
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                          {run.input}
                        </h3>
                        {expandedId === run.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs text-primary-700">
                          {run.model}
                        </Badge>
                        {run.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs bg-primary-50 text-primary-700"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(run.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {expandedId === run.id && (
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <div className="font-medium text-gray-700">Input:</div>
                        <div className="mt-1 text-gray-600 bg-gray-50 p-3 rounded-md">
                          {run.input}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700">Output:</div>
                        <div className="mt-1 text-gray-600 bg-gray-50 p-3 rounded-md">
                          {run.output}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
