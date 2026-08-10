export function resolveActiveCalculationEnd(actualStart: string, candidateEnd: string): string {
  const startMilliseconds = Date.parse(actualStart);
  const candidateMilliseconds = Date.parse(candidateEnd);
  if (candidateMilliseconds > startMilliseconds) return candidateEnd;
  return new Date(startMilliseconds + 1).toISOString();
}
