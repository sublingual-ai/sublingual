import { useState, useEffect } from 'react';
import { CallNode, LLMRun } from '@/types/logs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Code, MessageSquare, User, Bot, Loader2 } from 'lucide-react';
import { LLMInteraction } from '@/components/LLMInteraction';
import { LLMHeader } from '@/components/LLMHeader';

interface CallHierarchyProps {
  runs: LLMRun[];
  selectedSessionId?: string;
}

const TreeNode = ({ node, level = 0 }: { node: CallNode; level?: number }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRuns, setShowRuns] = useState(true);

  const hasChildren = node.children.length > 0;
  const hasRuns = node.runs.length > 0;

  return (
    <div className="tree-node">
      <div 
        className={`
          flex flex-col p-2 rounded-lg transition-colors
          ${hasRuns ? 'bg-primary-50/50' : 'hover:bg-gray-50'}
        `}
      >
        <button 
          onClick={() => hasChildren ? setIsExpanded(!isExpanded) : setShowRuns(!showRuns)}
          className="flex items-center w-full text-left"
        >
          <div className="w-6 h-6 flex items-center justify-center text-gray-500">
            {hasChildren ? (
              isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />
            ) : (
              hasRuns && (showRuns ? <ChevronDown size={18} /> : <ChevronRight size={18} />)
            )}
          </div>

          <div className="flex-1 flex items-center gap-2">
            <Code size={16} className="text-gray-500" />
            <span className="font-medium text-gray-700">
              {node.function}
            </span>
            <span className="text-sm text-gray-500">
              {node.filename.split('/').pop()}:{node.lineno}
            </span>
            
            {hasRuns && (
              <Badge variant="secondary" className="ml-2">
                <MessageSquare size={12} className="mr-1" />
                {node.runs.length} {node.runs.length === 1 ? 'call' : 'calls'}
              </Badge>
            )}
          </div>
        </button>

        {hasRuns && (
          <div className="mt-2 ml-6">
            <LLMHeader run={node.runs[0]} />
          </div>
        )}
      </div>

      {/* Show the actual LLM interactions */}
      {hasRuns && showRuns && (
        <div className="ml-6 mt-2 border-l border-gray-200 pl-4">
          {node.runs.map((run, index) => (
            <LLMInteraction key={index} run={run} />
          ))}
        </div>
      )}

      {/* Show children */}
      {hasChildren && isExpanded && (
        <div className="pl-6 mt-1 border-l border-gray-200">
          {node.children.map((child, index) => (
            <TreeNode key={index} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const CallHierarchy = ({ runs, selectedSessionId }: CallHierarchyProps) => {
  // Reset TreeNode states when runs or session changes
  useEffect(() => {
    // Find all TreeNode instances and reset their states
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
      const instance = (node as any).__reactFiber$;
      if (instance && instance.stateNode && instance.stateNode.setState) {
        instance.stateNode.setState({
          isExpanded: true,
          showRuns: true
        });
      }
    });
  }, [runs, selectedSessionId]);

  const buildHierarchy = (runs: LLMRun[]) => {
    const filteredRuns = runs.filter(run => {
      if (run.session_id) {
        return run.session_id === selectedSessionId;
      } else {
        return selectedSessionId?.startsWith('single-') && 
               selectedSessionId.includes(run.timestamp.toString());
      }
    });
    
    const nodeMap = new Map<string, CallNode>();
    
    filteredRuns.forEach(run => {
      if (!run.stack_trace || run.stack_trace.length === 0) return;

      // Walk through the stack trace
      let pathSoFar = '';
      
      for (let i = 0; i < run.stack_trace.length - 1; i++) {
        const frame = run.stack_trace[i];
        const nextFrame = run.stack_trace[i + 1];
        
        // Build unique keys that include the full path to this point
        const nodeKey = pathSoFar + `::${frame.filename}::${frame.function}::${frame.lineno}`;
        const nextKey = nodeKey + `::${nextFrame.filename}::${nextFrame.function}::${nextFrame.lineno}`;
        pathSoFar = nodeKey;
        
        // Get or create current node
        let node = nodeMap.get(nodeKey);
        if (!node) {
          node = {
            filename: frame.filename,
            function: frame.function,
            lineno: frame.lineno,
            children: [],
            runs: []
          };
          nodeMap.set(nodeKey, node);
        }

        // Get or create next node
        let nextNode = nodeMap.get(nextKey);
        if (!nextNode) {
          nextNode = {
            filename: nextFrame.filename,
            function: nextFrame.function,
            lineno: nextFrame.lineno,
            children: [],
            runs: []
          };
          nodeMap.set(nextKey, nextNode);
        }

        // Link them (no need to check includes since keys are unique)
        if (!node.children.includes(nextNode)) {
          node.children.push(nextNode);
        }

        // If next node is the LLM call, add the run to it
        if (i === run.stack_trace.length - 2) {
          nextNode.runs.push(run);
        }
      }
    });

    // Find root nodes (nodes with no parents)
    const allNodes = Array.from(nodeMap.values());
    const childNodes = new Set(allNodes.flatMap(node => node.children));
    const rootNodes = allNodes.filter(node => !childNodes.has(node));
    
    return rootNodes;
  };

  const hierarchy = buildHierarchy(runs);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 h-full flex flex-col animate-fade-in">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Call Hierarchy</h2>
        <p className="text-sm text-gray-500 mt-1">
          Visualizing the call stack for session {selectedSessionId}
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {hierarchy.map((node, index) => (
            <TreeNode key={index} node={node} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}; 