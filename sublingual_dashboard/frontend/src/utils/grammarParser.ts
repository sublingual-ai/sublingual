interface Token {
  type: 'literal' | 'variable' | 'inferred' | 'concat';
  value: string | null;
  name?: string;
  parts?: Token[];  // For concat tokens
  kwargs?: Record<string, Token>;  // For format kwargs
}

export function parseGrammarFormat(format: any): Token[] {
  // Handle Concat type
  if (format.type === 'Concat') {
    return [{
      type: 'concat',
      value: null,
      parts: format.parts.flatMap(part => parseGrammarFormat(part))
    }];
  }

  // Handle regular Var type
  if (format.type === 'Var') {
    return [{
      type: 'variable',
      value: format.name,
      name: format.name
    }];
  }

  // Handle InferredVar type
  if (format.type === 'InferredVar') {
    return [{
      type: 'inferred',
      value: format.value,
      name: format.name
    }];
  }

  // Handle simple literals
  if (format.type === 'Literal') {
    return [{
      type: 'literal',
      value: format.value
    }];
  }
  
  if (format.type === 'Format') {
    const tokens: Token[] = [];
    
    // Split the base template into parts using {} as delimiter
    const parts = format.base.value.split(/(\{\})/);
    
    let argIndex = 0;
    
    parts.forEach(part => {
      if (part === '{}') {
        // This is a placeholder - fill with the corresponding arg
        if (format.args && format.args[argIndex]) {
          tokens.push(...parseGrammarFormat(format.args[argIndex]));
        }
        argIndex++;
      } else if (part) {
        // This is a literal part of the template
        tokens.push({
          type: 'literal',
          value: part
        });
      }
    });

    // Handle kwargs if present
    if (format.kwargs && Object.keys(format.kwargs).length > 0) {
      const kwargTokens: Record<string, Token> = {};
      for (const [key, value] of Object.entries(format.kwargs)) {
        const parsedTokens = parseGrammarFormat(value);
        if (parsedTokens.length > 0) {
          kwargTokens[key] = parsedTokens[0];
        }
      }
      if (Object.keys(kwargTokens).length > 0) {
        tokens[0].kwargs = kwargTokens;  // Attach kwargs to first token
      }
    }
    
    return tokens;
  }
  
  return [];
}

export function reconstructString(tokens: Token[]): string {
  return tokens.map(token => {
    if (token.type === 'concat' && token.parts) {
      return reconstructString(token.parts);
    }
    return token.value ?? '';
  }).join('');
}

export function validateParsing(original: string | null, tokens: Token[]) {
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