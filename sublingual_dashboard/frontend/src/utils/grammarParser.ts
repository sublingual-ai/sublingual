interface GrammarNode {
  type: 'Format' | 'Literal' | 'Var' | 'InferredVar' | 'Concat';
  value?: string | null;
  name?: string;
  base?: GrammarNode;
  args?: GrammarNode[];
  parts?: GrammarNode[];
  kwargs?: Record<string, GrammarNode>;
}

export function parseGrammarFormat(format: any): GrammarNode {
  if (format.type === 'Concat') {
    return {
      type: 'Concat',
      parts: format.parts.map(part => parseGrammarFormat(part))
    };
  }

  if (format.type === 'Var') {
    return {
      type: 'Var',
      value: format.name,
      name: format.name
    };
  }

  if (format.type === 'InferredVar') {
    return {
      type: 'InferredVar',
      value: format.value,
      name: format.name
    };
  }

  if (format.type === 'Literal') {
    return {
      type: 'Literal',
      value: format.value
    };
  }
  
  if (format.type === 'Format') {
    return {
      type: 'Format',
      base: parseGrammarFormat(format.base),
      args: format.args?.map(arg => parseGrammarFormat(arg)) || [],
      kwargs: Object.fromEntries(
        Object.entries(format.kwargs || {}).map(
          ([k, v]) => [k, parseGrammarFormat(v)]
        )
      )
    };
  }
  
  return {
    type: 'Literal',
    value: '<unknown>'
  };
}

export function reconstructString(tokens: GrammarNode[]): string {
  return tokens.map(token => {
    if (token.type === 'Concat' && token.parts) {
      return reconstructString(token.parts);
    }
    return token.value ?? '';
  }).join('');
}

export function validateParsing(original: string | null, tokens: GrammarNode[]) {
  const reconstructed = reconstructString(tokens);
  return {
    valid: reconstructed === original,
    original,
    reconstructed,
    tokens
  };
}

// New function to parse entire grammar result
export function parseGrammarResult(grammarResult: any[]) {
  return grammarResult.map(item => ({
    role: item.role,
    tokens: parseGrammarFormat(item.content)
  }));
} 