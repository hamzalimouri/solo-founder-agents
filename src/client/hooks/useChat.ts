import { useState, useRef } from 'react';
import { streamChat } from '../api.js';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  agent?: { key: string; name: string; emoji: string };
  usage?: { inputTokens: number; outputTokens: number; cost: number };
  streaming?: boolean;
  activeTool?: string;
  timestamp: number;
}

export function useChat(agentKey: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<string>('');

  const send = async (text: string, forceAgent?: string) => {
    if (streaming) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, timestamp: Date.now() },
    ]);

    setStreaming(true);
    streamRef.current = '';

    const assistantMsg: ChatMsg = {
      role: 'assistant', content: '', streaming: true, timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, assistantMsg]);

    const updateLast = (patch: Partial<ChatMsg>) =>
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
        return updated;
      });

    await streamChat(text, forceAgent ?? (agentKey === 'auto' ? null : agentKey), {
      onAgent: (agent) => updateLast({ agent }),
      onText: (chunk) => {
        streamRef.current += chunk;
        updateLast({ content: streamRef.current });
      },
      onToolStart: (tool) => updateLast({ activeTool: tool }),
      onDone: (usage) => {
        updateLast({ streaming: false, activeTool: undefined, usage });
        setStreaming(false);
      },
      onError: (err) => {
        updateLast({ content: `❌ Error: ${err}`, streaming: false });
        setStreaming(false);
      },
    });
  };

  const clear = () => setMessages([]);

  return { messages, send, streaming, clear };
}
