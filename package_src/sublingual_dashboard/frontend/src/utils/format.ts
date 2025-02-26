export const formatElapsedTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}; 