const TELEGRAM_LIMIT = 4096;

export function formatAgentResponse(
  emoji: string,
  agentName: string,
  text: string,
  tokens: number,
  costUsd: number,
  budgetWarning?: string,
): string {
  const footer = `\n\n_— ${tokens.toLocaleString()} tokens · $${costUsd.toFixed(4)}_`;
  const header = `${emoji} *${agentName}*\n\n`;
  const warning = budgetWarning ? `\n\n⚠️ ${budgetWarning}` : '';
  return `${header}${text}${warning}${footer}`;
}

export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_LIMIT) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitAt = remaining.lastIndexOf('\n\n', TELEGRAM_LIMIT);
    if (splitAt === -1) splitAt = remaining.lastIndexOf('\n', TELEGRAM_LIMIT);
    if (splitAt === -1) splitAt = TELEGRAM_LIMIT;

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

export function escapeMd(text: string): string {
  // Escape special chars for MarkdownV2 — but we use Markdown mode (v1)
  return text;
}
