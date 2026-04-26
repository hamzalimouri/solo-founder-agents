import React from 'react';

// Lightweight markdown renderer — no heavy deps
export default function Markdown({ content }: { content: string }) {
  const html = render(content);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function render(md: string): string {
  let s = md
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="hljs language-${lang || 'plaintext'}">${code.trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/__(.+?)__/g, '<em>$1</em>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list items
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Paragraphs: double newline = paragraph break
    .replace(/\n\n+/g, '</p><p>')
    // Single newline = <br> (inside paragraphs)
    .replace(/\n/g, '<br />');

  // Wrap consecutive <li> in <ul>
  s = s.replace(/(<li>.*?<\/li>(\s*<br \/>)*)+/g, (match) =>
    `<ul>${match.replace(/<br \/>/g, '')}</ul>`);

  return `<p>${s}</p>`
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-3]>)/g, '$1')
    .replace(/(<\/h[1-3]>)<\/p>/g, '$1')
    .replace(/<p>(<pre>)/g, '$1')
    .replace(/(<\/pre>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<hr)/g, '$1')
    .replace(/(hr \/>)<\/p>/g, '$1')
    .replace(/<p>(<blockquote>)/g, '$1')
    .replace(/(<\/blockquote>)<\/p>/g, '$1');
}
