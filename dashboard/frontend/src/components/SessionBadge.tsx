import { Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SessionRow } from '@/types/logs';

interface SessionBadgeProps {
  session: SessionRow;
  selected?: boolean;
  onClick?: () => void;
}

export const SessionBadge = ({ session, selected, onClick }: SessionBadgeProps) => {
  return (
    <button
      className={`w-full text-left mt-1 px-3 py-2 rounded-md transition-colors ${
        selected 
          ? 'bg-primary-50 text-primary-900' 
          : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4" />
        <span className="text-sm font-medium">
          {session.runs.length === 1 && !session.runs[0].session_id
            ? `Single Call ${session.sessionId.slice(0, 8)}...`
            : `Session ${session.sessionId}`}
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        <Badge variant="secondary" className="text-xs">
          {session.callCount} calls
        </Badge>
        <Badge variant="outline" className="text-xs">
          {session.totalTokens} tokens
        </Badge>
      </div>
    </button>
  );
}; 