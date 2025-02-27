import { LLMRun, Message } from "@/types/logs";
import { SessionRow } from "@/types/metrics";

export const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(',', '');
};

export const getPreviewText = (messages: Message[], response: string) => {
    if (messages.length === 0) return '';
    
    const lastMessage = messages[messages.length - 1].content;
    // Handle case where content is an object
    const messageText = typeof lastMessage === 'string' ? lastMessage : 
        Array.isArray(lastMessage) ? (lastMessage as any[]).map(block => 
            block.type === 'text' ? block.text : '[Content]'
        ).join(' ') : '[Content]';
        
    const responseText = response || '[No response]';
    const preview = `${messageText} → ${responseText}`;
    return preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
};

export const getRunId = (run: LLMRun) => {
    const uniqueString = JSON.stringify({
        timestamp: run.timestamp,
        model: run.response.model,
        messages: run.messages,
        stack_info: run.stack_info,
        session_id: run.session_id,
        response: run.response
    });

    let hash = 0;
    for (let i = 0; i < uniqueString.length; i++) {
        const char = uniqueString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return `run-${Math.abs(hash)}`;
};

export const groupRunsIntoSessions = (runs: LLMRun[]): SessionRow[] => {
    const sessionMap = new Map<string, SessionRow>();
    
    runs.forEach(run => {
        const sessionId = run.session_id || getRunId(run);
        const existing = sessionMap.get(sessionId);
        
        if (existing) {
            existing.runs.push(run);
            existing.lastCall = Math.max(existing.lastCall, run.timestamp);
            existing.callCount += 1;
            existing.totalTokens += run.usage.total_tokens;
        } else {
            sessionMap.set(sessionId, {
                sessionId,
                runs: [run],
                firstCall: run.timestamp,
                lastCall: run.timestamp,
                callCount: 1,
                totalTokens: run.usage.total_tokens
            });
        }
    });
    
    return Array.from(sessionMap.values());
}; 