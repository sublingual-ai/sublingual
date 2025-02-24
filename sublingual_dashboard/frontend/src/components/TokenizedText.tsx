import { Token } from "@/types/logs";

interface TokenProps {
  token: Token;
}

const TokenSpan: React.FC<TokenProps> = ({ token }) => {
  let className = "px-1 rounded ";
  
  switch (token.type) {
    case 'literal':
      className += "bg-gray-100";
      break;
    case 'variable':
      className += "bg-blue-100";
      break;
    case 'inferred':
      className += "bg-green-100";
      break;
    case 'concat':
      return token.parts ? (
        <span className="space-x-1">
          {token.parts.map((part, i) => (
            <TokenSpan key={i} token={part} />
          ))}
        </span>
      ) : null;
  }

  const tooltip = token.name ? `${token.type}: ${token.name}` : token.type;

  return (
    <span 
      className={className} 
      title={tooltip}
    >
      {token.value ?? ''}
    </span>
  );
};

interface TokenizedTextProps {
  tokens: Token[];
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({ tokens }) => {
  return (
    <div className="space-x-1 font-mono text-sm">
      {tokens.map((token, i) => (
        <TokenSpan key={i} token={token} />
      ))}
    </div>
  );
}; 