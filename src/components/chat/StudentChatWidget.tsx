'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Cpu,
  Sparkles,
  Bot,
  User,
  BookOpen,
} from 'lucide-react';
import { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

export function StudentChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello Teacher! I am your AI trading student. I reason strictly from the rules, conditions, and exceptions you teach me in the Training workspace. What would you like to test or review?',
    },
  ]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const newMsgs: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs }),
      });

      if (res.ok) {
        const json = await res.json();
        setMessages([
          ...newMsgs,
          {
            role: 'assistant',
            content: json.reply,
            citations: json.citations,
          },
        ]);
      } else {
        setMessages([
          ...newMsgs,
          {
            role: 'assistant',
            content: 'I encountered an error querying my learned knowledge base.',
          },
        ]);
      }
    } catch {
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: 'Unable to reach local AI reasoning engine.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 px-3.5 py-2.5 rounded-full bg-surface-primary hover:bg-surface-secondary text-foreground border border-border shadow-2xl flex items-center space-x-2 text-xs font-mono transition-all hover:scale-105"
        >
          <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse"></span>
          <MessageSquare className="w-4 h-4 text-accent" />
          <span>Ask AI</span>
        </button>
      )}

      {/* Chat Terminal Dialog */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-96 max-w-[calc(100vw-2rem)] h-[520px] bg-surface-primary border border-border rounded-lg shadow-2xl flex flex-col font-mono text-xs overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border bg-surface-secondary/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-accent" />
              <div>
                <span className="font-semibold text-foreground">Ask AI (Trading Student)</span>
                <span className="block text-[10px] text-foreground-muted">Knowledge Grounded</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-foreground-muted hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start space-x-2',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded bg-surface-secondary border border-border flex items-center justify-center shrink-0 text-accent">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    'p-3 rounded text-xs max-w-[85%] leading-relaxed font-sans',
                    m.role === 'user'
                      ? 'bg-accent text-background font-medium font-mono'
                      : 'bg-surface-secondary border border-border text-foreground-secondary whitespace-pre-wrap'
                  )}
                >
                  <div>{m.content}</div>

                  {/* Grounded Citations (Section 24) */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1.5 font-mono text-[10px]">
                      <div className="flex items-center space-x-1 text-foreground-muted">
                        <BookOpen className="w-3 h-3 text-accent" />
                        <span className="uppercase tracking-wider">Approved Citations:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.citations.map((cite, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-tertiary border border-border text-foreground-secondary hover:text-accent transition-colors"
                            title={cite.detail || cite.title}
                          >
                            <span className="text-accent font-semibold mr-1">
                              {cite.type === 'RULE'
                                ? 'Rule'
                                : cite.type === 'EXCEPTION'
                                ? 'Exc'
                                : cite.type === 'LESSON'
                                ? 'Lesson'
                                : 'Ref'}
                              :
                            </span>
                            <span className="truncate max-w-[140px]">{cite.title}</span>
                            {cite.timestamp && (
                              <span className="ml-1 text-foreground-muted">@{cite.timestamp}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="w-6 h-6 rounded bg-surface-tertiary flex items-center justify-center shrink-0 text-foreground">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-foreground-muted text-[11px] italic flex items-center space-x-1.5">
                <Sparkles className="w-3 h-3 animate-spin text-accent" />
                <span>Student is reviewing approved knowledge rules...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts (Section 34 Cognitive Interrogations) */}
          <div className="px-3 py-2 border-t border-border/50 bg-surface-secondary/30 flex items-center space-x-1.5 overflow-x-auto text-[10px]">
            <button
              onClick={() => handleSend('Why are you waiting?')}
              className="px-2 py-1 rounded bg-surface-secondary text-foreground-muted hover:text-foreground border border-border whitespace-nowrap hover:border-accent transition-colors"
            >
              Why waiting?
            </button>
            <button
              onClick={() => handleSend('What are the competing hypotheses?')}
              className="px-2 py-1 rounded bg-surface-secondary text-foreground-muted hover:text-foreground border border-border whitespace-nowrap hover:border-accent transition-colors"
            >
              Competing hypotheses?
            </button>
            <button
              onClick={() => handleSend('What would change your mind?')}
              className="px-2 py-1 rounded bg-surface-secondary text-foreground-muted hover:text-foreground border border-border whitespace-nowrap hover:border-accent transition-colors"
            >
              What changes mind?
            </button>
            <button
              onClick={() => handleSend('What changed?')}
              className="px-2 py-1 rounded bg-surface-secondary text-foreground-muted hover:text-foreground border border-border whitespace-nowrap hover:border-accent transition-colors"
            >
              What changed?
            </button>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-border bg-surface-primary flex items-center space-x-2"
          >
            <input
              type="text"
              placeholder="Ask your AI trading student..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-surface-secondary border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-1.5 rounded bg-accent text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
