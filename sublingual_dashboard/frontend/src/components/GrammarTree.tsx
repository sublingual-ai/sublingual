import { GrammarNode } from "@/utils/grammarParser";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GrammarTreeProps {
  node: GrammarNode;
}

const GrammarTooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => (
  <TooltipProvider>
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent 
        className="max-w-sm bg-slate-900 text-slate-50 text-sm px-3 py-1.5"
        side="top"
        align="center"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const GrammarTree: React.FC<GrammarTreeProps> = ({ node }) => {
  switch (node.type) {
    case 'Format':
      if (!node.base?.value) return null;
      
      const parts = node.base.value.split(/(\{\})/);
      const elements: JSX.Element[] = [];
      let argIndex = 0;

      parts.forEach((part, i) => {
        if (part === '{}') {
          if (node.args && node.args[argIndex]) {
            elements.push(
              <span key={`arg-${i}`} className="mx-0.5">
                <GrammarTree node={node.args[argIndex]} />
              </span>
            );
          }
          argIndex++;
        } else if (part) {
          elements.push(
            <GrammarTooltip key={`lit-${i}`} content={`Format template: "${node.base.value}"`}>
              <span className="bg-indigo-200 rounded px-1">
                {part}
              </span>
            </GrammarTooltip>
          );
        }
      });

      return <span className="space-x-0">{elements}</span>;

    case 'Concat':
      return (
        <span className="space-x-0">
          {node.parts?.map((part, i) => (
            <GrammarTree key={i} node={part} />
          ))}
        </span>
      );

    case 'Var':
      return (
        <GrammarTooltip content={`Variable: ${node.name}`}>
          <span className="bg-amber-200 rounded px-1">
            {node.value}
          </span>
        </GrammarTooltip>
      );

    case 'InferredVar':
      return (
        <GrammarTooltip content={`Inferred variable "${node.name}" = "${node.value}"`}>
          <span className="bg-emerald-200 rounded px-1">
            {node.value}
          </span>
        </GrammarTooltip>
      );

    case 'Literal':
      return (
        <GrammarTooltip content={`Literal: "${node.value}"`}>
          <span className="bg-emerald-100 rounded px-1">
            {node.value}
          </span>
        </GrammarTooltip>
      );

    default:
      return <span>{node.value ?? ''}</span>;
  }
}; 