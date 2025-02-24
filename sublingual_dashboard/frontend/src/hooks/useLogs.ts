import { useState, useEffect } from 'react';
import { LLMRun, SessionRow } from '@/types/logs';
import { groupRunsIntoSessions } from '@/utils/sessionUtils';
import { API_BASE_URL } from '@/config';

export const useLogs = (selectedFile: string | null) => {
  const [runs, setRuns] = useState<LLMRun[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFile) return;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/get_log?filename=${selectedFile}`);
        if (!res.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data: LLMRun[] = await res.json();

        // Construct response_texts array from response choices
        data.forEach(run => {
          if (run.response?.choices) {
            run.response_texts = run.response.choices.map(choice => choice.message.content);
          }
        });

        setRuns(data);
        setSessions(groupRunsIntoSessions(data));
      } catch (error) {
        console.error('Error fetching logs:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch logs');
        setRuns([]);
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedFile]);

  return { runs, sessions, isLoading, error };
}; 