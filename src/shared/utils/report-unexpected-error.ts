export function reportUnexpectedError(context: string, error: unknown): void {
  console.error(`[Shiftty:${context}]`, error);
}
