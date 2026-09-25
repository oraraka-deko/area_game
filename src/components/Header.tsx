import React, { useState } from 'react';
import { UserProfile } from '../types/game.js';
import { sound } from '../utils/audio.js';
import { Volume2, VolumeX, HelpCircle, PlusCircle, MessageSquare } from 'lucide-react';

interface HeaderProps {
  user: UserProfile;
  onClaimFaucet: () => void;
  onOpenHowItWorks: () => void;
  onToggleChat: () => void;
  unreadChatCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onClaimFaucet,
  onOpenHowItWorks,
  onToggleChat,
  unreadChatCount
}) => {
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

  const toggleSound = () => {
    const newState = sound.toggle();
    setSoundEnabled(newState);
  };

  return (
    <header className="flex items-center justify-between px-3 py-2.5 bg-[#12131d]/90 border-b border-white/5 backdrop-blur-md sticky top-0 z-30">
      {/* User Profile Mini Bar */}
      <div className="flex items-center gap-2.5">
        <div className="relative group cursor-pointer">
          <img
            src={user.avatar}
            alt={user.username}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-[#ccff00]/60 ring-offset-2 ring-offset-[#0c0d14]"
          />
          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0c0d14]" />
        </div>
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-white/90 leading-tight">
            {user.username}
          </div>
          <div className="text-[11px] text-white/50">Level 8 Contender</div>
        </div>
      </div>

      {/* Center Actions: Balance & Deposit Faucet */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClaimFaucet}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 rounded-xl text-purple-200 text-xs font-bold transition active:scale-95 shadow-sm"
          title="Claim free faucet credits"
        >
          <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Faucet</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d2d] border border-white/10 rounded-xl shadow-inner">
          <span className="text-amber-400 text-sm">🪙</span>
          <span className="font-mono font-bold text-white text-xs sm:text-sm tracking-tight">
            {user.credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-white/40 hidden xs:inline font-mono">CREDITS</span>
        </div>
      </div>

      {/* Right Controls: Sound, Chat & Help */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={toggleSound}
          className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#ccff00]" />
          ) : (
            <VolumeX className="w-4 h-4 text-white/40" />
          )}
        </button>

        <button
          onClick={onToggleChat}
          className="relative p-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          title="Live Arena Chat & AI Commentary"
        >
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ccff00] text-black text-[9px] font-extrabold flex items-center justify-center animate-pulse">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenHowItWorks}
          className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          title="How the Arena Works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
