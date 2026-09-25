import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile } from '../types/game.js';
import { Send, Bot, X, Sparkles, HelpCircle } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface LiveChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  user: UserProfile;
  onSendMessage: (text: string) => void;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  isOpen,
  onClose,
  messages,
  user,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    sound.playClick();
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const askAiAssistant = async (presetPrompt: string) => {
    sound.playClick();
    setAiLoading(true);
    try {
      const res = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: presetPrompt })
      });
      const data = await res.json();
      if (data.answer) {
        // Appends to local messages via regular path or state
        onSendMessage(`[Question to Master]: ${presetPrompt}`);
      }
    } catch (err) {
      console.error('Failed to ask AI master:', err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 bg-[#0f111a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-[#141624]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="font-extrabold text-sm text-white">Live Arena Feed</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
            Gemini AI
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* AI Master Quick Prompt Pills */}
      <div className="p-2 border-b border-white/5 bg-[#12141f] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-white/40 flex-shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#ccff00]" />
          <span>Ask AI:</span>
        </span>
        <button
          disabled={aiLoading}
          onClick={() => askAiAssistant('How is provably fair guaranteed?')}
          className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 hover:text-white border border-white/5 whitespace-nowrap flex-shrink-0"
        >
          Explain Fairness
        </button>
        <button
          disabled={aiLoading}
          onClick={() => askAiAssistant('What is the best staking strategy?')}
          className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 hover:text-white border border-white/5 whitespace-nowrap flex-shrink-0"
        >
          Strategy Advice
        </button>
      </div>

      {/* Messages List */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs scrollbar-thin scrollbar-thumb-white/10"
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-2.5 rounded-2xl ${
              msg.isAi
                ? 'bg-gradient-to-r from-purple-950/60 to-cyan-950/60 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : msg.sender === user.username
                ? 'bg-[#1e2235] border border-[#ccff00]/40 ml-4'
                : 'bg-[#151724] border border-white/5 mr-4'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5">
                {msg.isAi ? (
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                ) : msg.avatar ? (
                  <img
                    src={msg.avatar}
                    alt={msg.sender}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : null}

                <span
                  className={`font-bold ${
                    msg.isAi
                      ? 'text-cyan-300 font-mono tracking-tight'
                      : msg.sender === user.username
                      ? 'text-[#ccff00]'
                      : 'text-white/80'
                  }`}
                >
                  {msg.sender}
                </span>

                {msg.badge && (
                  <span className="text-[9px] font-black uppercase px-1 rounded bg-[#ccff00] text-black">
                    {msg.badge}
                  </span>
                )}
              </div>

              <span className="text-[9px] text-white/30 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>

            <p
              className={`leading-relaxed ${
                msg.isAi
                  ? 'text-cyan-100 font-semibold text-xs'
                  : 'text-white/80'
              }`}
            >
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-[#141624] border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Send message to arena..."
          maxLength={180}
          className="flex-1 px-3 py-2 rounded-xl bg-[#1b1e2e] border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[#ccff00]/60"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-[#ccff00] text-black hover:bg-[#b8e600] disabled:opacity-40 transition active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
