import { useState, useEffect } from 'react';
import { LLMRun, SessionRow } from '@/types/logs';
import { groupRunsIntoSessions } from '@/utils/sessionUtils';
import { API_BASE_URL } from '@/config';

export function useLogs(files: string | string[]) {
  const [data, setData] = useState<{ runs: LLMRun[], sessions: SessionRow[] }>({ runs: [], sessions: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!files || (Array.isArray(files) && files.length === 0)) {
      setData({ runs: [], sessions: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fileList = Array.isArray(files) ? files : [files];
    Promise.all(fileList.map(file => 
      fetch(`${API_BASE_URL}/get_log?filename=${file}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch log: ${file}`);
          return res.json();
        })
    ))
    .then(results => {
      const allRuns = results.flatMap(runs => {
        // Add logging here
        console.log('Fetched logs:', {
          numRuns: runs.length,
          firstRun: runs[0],
          lastRun: runs[runs.length - 1]
        });

        // Construct response_texts array from response choices
        runs.forEach(run => {
          if (run.response?.choices) {
            run.response_texts = run.response.choices.map(choice => choice.message.content);
          }
        });
        return runs;
      });
      
      // Add summary logging
      console.log('Processed all logs:', {
        totalRuns: allRuns.length,
        sessions: processRuns(allRuns).length
      });
      
      setData({
        runs: allRuns,
        sessions: processRuns(allRuns)
      });
    })
    .catch(err => {
      console.error('Error fetching logs:', err);
      setError(err.message);
      setData({ runs: [], sessions: [] });
    })
    .finally(() => {
      setIsLoading(false);
    });
  }, [files]);

  return { ...data, isLoading, error };
}

function processRuns(runs: LLMRun[]): SessionRow[] {
  // Implement the logic to process runs and return sessions
  return groupRunsIntoSessions(runs);
} 