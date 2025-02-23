export interface Message {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
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

export interface LLMRun {
  session_id: string;
  messages: Message[];
  response_texts: string[];
  symbolic_mappings: any[];
  response: {
    model: string;
    usage: {
      total_tokens: number;
      // ... other usage fields
    };
    choices: Choice[];
    // ... other response fields
  };
  usage: {
    total_tokens: number;
    // ... other usage fields
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