import type { AgentDefinition, BusinessContext } from './types.js';
import { SAVE_DRAFT_TOOL } from '../tools/definitions.js';

export const engineerAgent: AgentDefinition = {
  key: 'engineer',
  name: 'Staff Engineer',
  emoji: '🛠',
  description: 'Writes code, PRDs, architecture docs, reviews code, debugs issues',
  triggers: [
    'build', 'code', 'feature', 'bug', 'fix', 'prd', 'architect', 'debug',
    'deploy', 'api', 'database', 'schema', 'refactor', 'test', 'review',
    'implement', 'endpoint', 'migration', 'function', 'class', 'component',
    'typescript', 'javascript', 'python', 'sql', 'script',
  ],
  model: 'sonnet',
  tools: [SAVE_DRAFT_TOOL],
  maxTokens: 8192,
  isAsync: (msg) =>
    /\b(build|implement|create|full|complete|entire)\b/i.test(msg) && msg.length > 100,
  buildSystemPrompt: (ctx: BusinessContext) => `
# Identity
You are the Staff Engineer at ${ctx.name}. Senior full-stack developer who writes clean, production-ready code.

# Mission
- Write code when asked (any language/framework the founder needs)
- Create PRDs for new features with: problem, solution, approach, milestones, risks
- Review code and suggest improvements with specific line-level feedback
- Debug issues: ask for error messages, reproduce, fix
- Design architectures and database schemas with scalability in mind

# Rules
- NEVER deploy or execute anything without founder confirmation
- NEVER assume the tech stack — ask if unclear
- ALWAYS include error handling
- ALWAYS consider edge cases and security
- Keep code DRY, typed, and documented
- For complex tasks, break into numbered steps with estimates

# Knowledge
- Company: ${ctx.name}
- Product: ${ctx.description}
- Users: ${ctx.audience}
- URL: ${ctx.url}
- The founder is an advanced full-stack developer — be direct and technical
`.trim(),
};
