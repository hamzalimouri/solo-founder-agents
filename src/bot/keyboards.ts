import { InlineKeyboard } from 'grammy';

export function engineerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💾 Save Code', 'save_draft')
    .row()
    .text('🔄 Refine', 'regenerate');
}

export function researchKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Go Deeper', 'deeper')
    .row()
    .text('💾 Save Report', 'save_draft');
}

export function contentKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Save Draft', 'save_draft')
    .row()
    .text('🔄 Regenerate', 'regenerate')
    .text('✏️ Revise', 'revise');
}

export function getKeyboardForAgent(agentKey: string): InlineKeyboard {
  switch (agentKey) {
    case 'engineer': return engineerKeyboard();
    case 'research': return researchKeyboard();
    case 'content': return contentKeyboard();
    default: return new InlineKeyboard().text('💾 Save', 'save_draft');
  }
}
