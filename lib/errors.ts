export function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  const uncaught = error.message.split("Uncaught Error: ")[1];
  if (uncaught) return uncaught.split("\n")[0] ?? uncaught;
  return error.message;
}
