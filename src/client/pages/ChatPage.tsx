import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Wrench } from 'lucide-react';
import { useChat } from '../hooks/useChat.js';
import Markdown from '../components/Markdown.js';
import { fmtCost, fmtTokens } from '../utils/format.js';

const AGENTS = [
  { key: 'auto', name: 'Auto-route', emoji: '⚡' },
  { key: 'engineer', name: 'Staff Engineer', emoji: '🛠' },
  { key: 'research', name: 'Research Agent', emoji: '🔍' },
  { key: 'content', name: 'Content Strategist', emoji: '✍️' },
];

export default function ChatPage() {
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [input, setInput] = useState('');
  const { messages, send, streaming, clear } = useChat(selectedAgent);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    send(text, selectedAgent === 'auto' ? undefined : selectedAgent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen">
      {/* Agent sidebar */}
      <div className="w-48 bg-[#141416] border-r border-[#2a2a2e] flex flex-col flex-shrink-0 p-3">
        <div className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider px-2 mb-3">Agent</div>
        <div className="space-y-0.5 flex-1">
          {AGENTS.map((a) => (
            <button
              key={a.key}
              onClick={() => setSelectedAgent(a.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedAgent === a.key
                  ? 'bg-[#1c1c20] text-white'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#1c1c20]'
              }`}
            >
              <span className="mr-2">{a.emoji}</span>
              {a.name}
            </button>
          ))}
        </div>
        <button
          onClick={clear}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1c1c20] transition-colors"
        >
          <Trash2 size={13} />
          Clear chat
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-[#52525b] text-sm">
              Send a message to start a conversation with your AI team.
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-xl bg-[#6366f1] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-3xl w-full">
                  {msg.agent && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{msg.agent.emoji}</span>
                      <span className="text-sm font-medium text-white">{msg.agent.name}</span>
                      {msg.streaming && (
                        <span className="flex gap-1">
                          {[0, 1, 2].map((d) => (
                            <span
                              key={d}
                              className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce"
                              style={{ animationDelay: `${d * 0.15}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  )}

                  {msg.activeTool && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-[#a1a1aa]">
                      <Wrench size={12} className="animate-spin" />
                      Calling {msg.activeTool}…
                    </div>
                  )}

                  <div className="card p-4">
                    {msg.content ? (
                      <Markdown content={msg.content} />
                    ) : (
                      <div className="flex gap-1 py-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="w-1.5 h-1.5 bg-[#a1a1aa] rounded-full animate-bounce"
                            style={{ animationDelay: `${d * 0.15}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.usage && (
                    <div className="text-xs text-[#52525b] mt-1.5 px-1">
                      {fmtTokens(msg.usage.inputTokens + msg.usage.outputTokens)} tokens · {fmtCost(msg.usage.cost)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a2e] p-4">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="input resize-none flex-1 py-2.5 max-h-32"
              style={{ height: 'auto', minHeight: '42px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="btn-primary px-4 py-2.5 flex-shrink-0 flex items-center gap-2"
            >
              <Send size={16} />
              Send
            </button>
          </div>
          <div className="text-xs text-[#52525b] text-center mt-2">
            {selectedAgent === 'auto'
              ? '⚡ Auto-routing to best agent'
              : `Sending to ${AGENTS.find((a) => a.key === selectedAgent)?.emoji} ${AGENTS.find((a) => a.key === selectedAgent)?.name}`}
          </div>
        </div>
      </div>
    </div>
  );
}
