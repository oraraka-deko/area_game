import React, { useState } from 'react';
import { UserProfile } from '../types/game.js';
import { InAppWallet } from '../types/wallet.js';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import {
  Volume2,
  VolumeX,
  HelpCircle,
  PlusCircle,
  MessageSquare,
  ArrowLeft,
  Wallet,
  ShieldAlert
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
  onClaimFaucet,
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
                className="w-8 h-8 rounded-full object-cover ring-1.5 ring-[#ccff00]/60"
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
          <span className="text-xs font-black uppercase text-[#ccff00] tracking-wider truncate max-w-[100px]">
            {activeGameTitle}
          </span>
        )}
      </div>

      {/* Center Actions: In-App Wallet & Game Credits */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* In-App Wallet Button */}
        {onOpenWallet && (
          <button
            onClick={() => {
              haptic.selection();
              onOpenWallet();
            }}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-xl transition active:scale-95 shadow-sm"
            title="Open In-App Wallet (TON & Stars)"
          >
            <span className="text-xs">💎</span>
            <span className="font-mono font-bold text-cyan-300 text-xs">
              {wallet ? wallet.tonBalance.toFixed(2) : '0.00'}
            </span>
          </button>
        )}

        {/* Game Credits */}
        <div
          onClick={onOpenWallet}
          className="cursor-pointer flex items-center gap-1 px-2 py-1 bg-[#1a1d2d] border border-white/10 rounded-xl shadow-inner active:scale-95 transition"
        >
          <span className="text-amber-400 text-xs">🪙</span>
          <span className="font-mono font-black text-white text-xs tracking-tight">
            {user.credits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Quick Faucet */}
        <button
          onClick={() => {
            haptic.impact('medium');
            onClaimFaucet();
          }}
          className="flex items-center gap-0.5 px-1.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-xl text-purple-200 text-[10px] font-bold transition active:scale-95"
          title="Claim free faucet credits"
        >
          <PlusCircle className="w-3 h-3 text-purple-400" />
          <span>+500</span>
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
            className="p-1.5 text-purple-400 hover:text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition"
            title="Admin Vault"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={toggleSound}
          className="p-1.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#ccff00]" />
          ) : (
            <VolumeX className="w-4 h-4 text-white/40" />
          )}
        </button>

        {onToggleChat && (
          <button
            onClick={() => {
              haptic.selection();
              onToggleChat();
            }}
            className="relative p-1.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
            title="Chat & Live Commentary"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#ccff00] text-black text-[8px] font-black flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => {
            haptic.selection();
            onOpenHowItWorks();
          }}
          className="p-1.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          title="Info"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
