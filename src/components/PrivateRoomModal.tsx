import React, { useState } from 'react';
import { X, Lock, Copy, Check, Users, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface PrivateRoomModalProps {
  onClose: () => void;
}

export const PrivateRoomModal: React.FC<PrivateRoomModalProps> = ({ onClose }) => {
  const [roomCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [tier, setTier] = useState<'standard' | 'high_roller'>('standard');
  const [allowBots, setAllowBots] = useState(true);
  const [copied, setCopied] = useState(false);

  const roomLink = typeof window !== 'undefined' ? `${window.location.origin}?room=${roomCode}` : '';

  const handleCopy = () => {
    sound.playClick();
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#12141f] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Private Room</h3>
              <p className="text-xs text-white/50">Play with friends in custom pot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Room Code & Link */}
        <div className="my-4 space-y-3">
          <div className="p-3 rounded-2xl bg-[#171926] border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
              Room Access Code
            </span>
            <div className="font-mono text-2xl font-black text-[#ccff00] tracking-widest my-1">
              {roomCode}
            </div>
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-white/5 mt-2">
              <span className="text-[11px] font-mono text-white/60 truncate">
                {roomLink}
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-[#ccff00] text-black text-xs font-bold flex items-center gap-1 flex-shrink-0"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Tier Selector */}
          <div>
            <label className="text-xs font-bold text-white/70 block mb-1.5">Stakes Tier</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTier('standard')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  tier === 'standard'
                    ? 'bg-white/15 border-white text-white'
                    : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                Standard (10 🪙 min)
              </button>
              <button
                onClick={() => setTier('high_roller')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  tier === 'high_roller'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                High Roller (500 🪙 min)
              </button>
            </div>
          </div>

          {/* AI Bots Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
            <div>
              <div className="text-xs font-bold text-white">Simulated Opponents</div>
              <div className="text-[10px] text-white/50">Allow bot players to join pot</div>
            </div>
            <button
              onClick={() => setAllowBots(!allowBots)}
              className={`w-11 h-6 rounded-full transition relative ${
                allowBots ? 'bg-[#ccff00]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${
                  allowBots ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="w-full py-2.5 rounded-2xl bg-[#ccff00] text-black font-extrabold text-xs uppercase tracking-wide hover:bg-[#b8e600] active:scale-95 transition"
        >
          Enter Private Arena
        </button>
      </div>
    </div>
  );
};
