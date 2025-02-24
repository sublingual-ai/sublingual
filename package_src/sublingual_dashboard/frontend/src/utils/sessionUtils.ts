import { LLMRun, SessionRow } from "@/types/logs";

export const groupRunsIntoSessions = (runs: LLMRun[]): SessionRow[] => {
  const sessionRows = runs.reduce((acc: SessionRow[], run) => {
    if (!run.session_id) {
      // Create individual session for runs without session_id
      const uniqueId = `single-${run.timestamp}-${Math.random().toString(36).substr(2, 5)}`;
      acc.push({
        sessionId: uniqueId,
        runs: [run],
        callCount: 1,
        firstCall: run.timestamp,
        lastCall: run.timestamp,
        totalTokens: run.response.usage.total_tokens
      });
    } else {
      // Find or create session group
      let sessionGroup = acc.find(s => s.sessionId === run.session_id);
      if (!sessionGroup) {
        sessionGroup = {
          sessionId: run.session_id,
          runs: [],
          callCount: 0,
          firstCall: run.timestamp,
          lastCall: run.timestamp,
          totalTokens: 0
        };
        acc.push(sessionGroup);
      }
      sessionGroup.runs.push(run);
      sessionGroup.callCount++;
      sessionGroup.firstCall = Math.min(sessionGroup.firstCall, run.timestamp);
      sessionGroup.lastCall = Math.max(sessionGroup.lastCall, run.timestamp);
      sessionGroup.totalTokens += run.response.usage.total_tokens;
    }
    return acc;
  }, []);

  // Sort sessions by timestamp
  return sessionRows.sort((a, b) => b.lastCall - a.lastCall);
}; 