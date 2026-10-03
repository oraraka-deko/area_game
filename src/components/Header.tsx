import React, { useState } from 'react';
import { UserProfile } from '../types/game.js';
import { InAppWallet } from '../types/wallet.js';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import {
  Volume2,
  VolumeX,
  HelpCircle,
  MessageSquare,
  ArrowLeft,
  ShieldAlert,
  Wallet
} from 'lucide-react';

interface HeaderProps {
  user: UserProfile;
  wallet?: InAppWallet;
  activeGameTitle?: string | null;
  onBackToMenu?: () => void;
  onClaimFaucet: () => void;
  onOpenHowItWorks: () => void;
  onToggleChat?: () => void;
  onOpenWallet?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
  unreadChatCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  wallet,
  activeGameTitle,
  onBackToMenu,
  onOpenHowItWorks,
  onToggleChat,
  onOpenWallet,
  onOpenAdmin,
  isAdmin = false,
  unreadChatCount = 0
}) => {
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

  const toggleSound = () => {
    const newState = sound.toggle();
    setSoundEnabled(newState);
    haptic.selection();
  };

  const tonBalance = wallet ? wallet.tonBalance : (user.tonBalance || 0);
  const starsBalance = wallet ? wallet.starsBalance : (user.starsBalance || 0);

  return (
    <header className="w-full flex items-center justify-between px-3 py-2 bg-[#10121f]/95 border-b border-white/5 backdrop-blur-md sticky top-0 z-30">
      {/* Left: Back button if in game, else User Avatar & Name */}
      <div className="flex items-center gap-2 min-w-0">
        {activeGameTitle && onBackToMenu ? (
          <button
            onClick={() => {
              haptic.impact('light');
              onBackToMenu();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Menu</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-8 h-8 rounded-full object-cover ring-1.5 ring-cyan-400/60"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#0c0d14]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate max-w-[80px] xs:max-w-[110px]">
                {user.username}
              </div>
            </div>
          </div>
        )}

        {activeGameTitle && (
          <span className="text-xs font-black uppercase text-cyan-400 tracking-wider truncate max-w-[100px]">
            {activeGameTitle}
          </span>
        )}
      </div>

      {/* Center Actions: In-App Wallet Balances (TON & Telegram Stars) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* TON Balance */}
        <button
          onClick={() => {
            haptic.selection();
            if (onOpenWallet) onOpenWallet();
          }}
          className="flex items-center gap-1 px-2 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 rounded-xl transition active:scale-95 shadow-sm"
          title="In-App TON Balance - Click to Deposit or Withdraw"
        >
          <span className="text-xs">💎</span>
          <span className="font-mono font-bold text-cyan-300 text-xs">
            {tonBalance.toFixed(2)} <span className="text-[10px] text-cyan-400/70">TON</span>
          </span>
        </button>

        {/* Telegram Stars Balance */}
        <button
          onClick={() => {
            haptic.selection();
            if (onOpenWallet) onOpenWallet();
          }}
          className="flex items-center gap-1 px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl transition active:scale-95 shadow-sm"
          title="In-App Telegram Stars Balance - Click to Deposit"
        >
          <span className="text-xs">⭐</span>
          <span className="font-mono font-bold text-amber-300 text-xs">
            {starsBalance.toLocaleString()}
          </span>
        </button>
      </div>

      {/* Right Controls: Sound, Admin, Chat & Help */}
      <div className="flex items-center gap-1 shrink-0">
        {isAdmin && onOpenAdmin && (
          <button
            onClick={() => {
              haptic.selection();
              onOpenAdmin();
            }}
            className="p-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 transition active:scale-95"
            title="Admin & Operations Panel"
          >
            <ShieldAlert className="w-4 h-4 text-purple-400 animate-pulse" />
          </button>
        )}

        {onToggleChat && (
          <button
            onClick={() => {
              haptic.selection();
              onToggleChat();
            }}
            className="relative p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
            title="Arena Live Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-black text-[9px] font-black flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={toggleSound}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
          title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-white/40" />}
        </button>

        <button
          onClick={() => {
            haptic.selection();
            onOpenHowItWorks();
          }}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
          title="How Provably Fair Works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
