export interface Message {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface StackInfo {
  filename: string;
  lineno: number;
  code_context: string[];
  caller_function_name: string;
}

export interface StackFrame {
  filename: string;
  lineno: number;
  code_context: string[];
  function: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface Choice {
  finish_reason: string;
  index: number;
  message: {
    content: string | null;
    role: string;
    tool_calls?: ToolCall[];
  };
}

export interface GrammarFormat {
  type: 'Format' | 'Literal';
  base?: {
    type: 'Literal';
    value: string;
  };
  args?: {
    type: 'Literal';
    value: string;
  }[];
  kwargs?: Record<string, any>;
  value?: string;
}

export interface GrammarResult {
  role: string;
  content: GrammarFormat;
}

export interface LLMRun {
  session_id: string;
  messages: Message[];
  response_texts: string[];
  symbolic_mappings: any[];
  grammar_result?: GrammarResult[];
  response: {
    model: string;
    usage: {
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
      completion_ms?: number;
    };
    choices: Choice[];
  };
  usage: {
    total_tokens: number;
  };
  timestamp: number;
  stack_trace?: StackFrame[];
  stack_info?: StackInfo;
  call_parameters: {
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    stop: string[];
    n: number;
  };
  extra_info: Record<string, any>;
  duration_ms: number;
}

export interface SessionRow {
  sessionId: string;
  runs: LLMRun[];
  callCount: number;
  firstCall: number;
  lastCall: number;
  totalTokens: number;
}

export interface CallNode {
  filename: string;
  function: string;
  lineno: number;
  children: CallNode[];
  runs: LLMRun[];
  totalDescendantRuns?: number;
}

export interface HierarchyData {
  nodes: CallNode[];
  sessionId?: string;
}

export interface Filter {
  field: string;
  value: any;
  operator?: 'in' | 'clear' | string;
  runIds?: string[];
}

export interface FilterOption {
  field: string;
  label: string;
  values: any[];
  type: 'select' | 'number' | 'boolean' | 'multiselect';
}

export interface Token {
  type: 'literal' | 'variable' | 'inferred' | 'concat';
  value: string | null;
  name?: string;
  parts?: Token[];
  kwargs?: Record<string, Token>;
} 