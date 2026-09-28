import React, { useState } from 'react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { UserProfile } from '../../types/game.js';
import { InAppWallet } from '../../types/wallet.js';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import {
  Trophy,
  Copy,
  Check,
  ShieldCheck,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  ShieldAlert,
  Coins
} from 'lucide-react';

interface ProfileScreenProps {
  user: UserProfile;
  wallet?: InAppWallet;
  onOpenWallet?: () => void;
  onOpenGiftsCatalog?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  wallet,
  onOpenWallet,
  onOpenGiftsCatalog,
  onOpenAdmin,
  isAdmin = false
}) => {
  const tonAddress = useTonAddress();
  const [copied, setCopied] = useState<boolean>(false);

  const referralLink = `https://t.me/ArenaPvPBot?start=ref_${user.id}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    sound.playClick();
    haptic.notification('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* User Header Profile Card */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#181c2e] to-[#0f121d] p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.username}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-[#ccff00] shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-black">
              ✓
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white truncate">
                {user.username}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ccff00]/20 text-[#ccff00] border border-[#ccff00]/40">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-white/50 font-mono mt-0.5">
              Telegram ID: {user.id}
            </div>
            <div className="text-xs font-mono font-black text-[#ccff00] mt-1">
              Credits: {user.credits.toFixed(0)} 🪙
            </div>
          </div>
        </div>

        {/* In-App Internal Wallet Card */}
        <div className="p-3.5 rounded-2xl bg-[#131626] border border-cyan-500/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                In-App Balances
              </span>
            </div>

            {onOpenWallet && (
              <button
                onClick={() => {
                  haptic.selection();
                  onOpenWallet();
                }}
                className="text-[10px] font-bold font-mono text-cyan-400 hover:text-cyan-300 underline"
              >
                Manage Wallet →
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span className="text-white/50 font-mono">TON:</span>
              <span className="font-mono font-black text-cyan-300">
                {wallet ? wallet.tonBalance.toFixed(3) : '0.000'} 💎
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span className="text-white/50 font-mono">Stars:</span>
              <span className="font-mono font-black text-amber-400">
                {wallet ? wallet.starsBalance.toLocaleString() : '100'} ⭐
              </span>
            </div>
          </div>

          {onOpenWallet && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  haptic.selection();
                  onOpenWallet();
                }}
                className="py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Deposit</span>
              </button>

              <button
                onClick={() => {
                  haptic.selection();
                  onOpenWallet();
                }}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Withdraw</span>
              </button>
            </div>
          )}
        </div>

        {/* TON Connect External Wallet Section */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">💎</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Connected TON Wallet
              </div>
              <div className="text-xs font-mono text-cyan-300 truncate max-w-[140px]">
                {tonAddress ? `${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : 'Not Connected'}
              </div>
            </div>
          </div>

          <TonConnectButton className="scale-90 origin-right" />
        </div>
      </div>

      {/* Quick Launchers: Gifts Catalog & Admin */}
      <div className="grid grid-cols-2 gap-2">
        {onOpenGiftsCatalog && (
          <button
            onClick={() => {
              haptic.selection();
              onOpenGiftsCatalog();
            }}
            className="p-3 rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 flex items-center justify-between text-left transition active:scale-95"
          >
            <div>
              <div className="text-xs font-black text-white flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-purple-400" />
                <span>Gifts Catalog</span>
              </div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">149 Indexed Gifts</div>
            </div>
            <span className="text-lg">🎁</span>
          </button>
        )}

        {isAdmin && onOpenAdmin && (
          <button
            onClick={() => {
              haptic.selection();
              onOpenAdmin();
            }}
            className="p-3 rounded-2xl bg-gradient-to-br from-purple-900/60 to-black/60 border border-purple-500/40 flex items-center justify-between text-left transition active:scale-95"
          >
            <div>
              <div className="text-xs font-black text-purple-300 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin Vault</span>
              </div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">Hot Wallet & API</div>
            </div>
            <span className="text-lg">⚙️</span>
          </button>
        )}
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl border border-white/5 bg-[#121422] text-center">
          <div className="text-[10px] text-white/40 font-mono uppercase">Matches</div>
          <div className="text-lg font-black font-mono text-white mt-0.5">148</div>
        </div>
        <div className="p-3 rounded-2xl border border-white/5 bg-[#121422] text-center">
          <div className="text-[10px] text-white/40 font-mono uppercase">Win Rate</div>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">42.8%</div>
        </div>
        <div className="p-3 rounded-2xl border border-white/5 bg-[#121422] text-center">
          <div className="text-[10px] text-white/40 font-mono uppercase">Won Total</div>
          <div className="text-lg font-black font-mono text-[#ccff00] mt-0.5">14.2k 🪙</div>
        </div>
      </div>

      {/* Referral Program */}
      <div className="rounded-3xl border border-purple-500/30 bg-[#121424] p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Telegram Referral Program
            </span>
          </div>
          <span className="text-[10px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">
            +10% Bonus
          </span>
        </div>

        <p className="text-xs text-white/60 leading-relaxed">
          Invite friends to Telegram Mini App and receive 10% of their tournament winnings directly into your internal balance!
        </p>

        <div className="flex items-center gap-2 bg-black/40 rounded-xl p-1.5 border border-white/5">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-transparent text-xs font-mono text-white/70 px-2 outline-none select-all truncate"
          />
          <button
            onClick={handleCopyReferral}
            className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition active:scale-95 flex items-center gap-1 shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
