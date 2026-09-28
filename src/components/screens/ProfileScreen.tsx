import React, { useState } from 'react';
import { TonConnectButton, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { UserProfile } from '../../types/game.js';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { Trophy, Copy, Check, ShieldCheck, Flame, Users, ExternalLink } from 'lucide-react';

interface ProfileScreenProps {
  user: UserProfile;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user }) => {
  const tonAddress = useTonAddress();
  const wallet = useTonWallet();
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
              Balance: {user.credits.toFixed(2)} 🪙
            </div>
          </div>
        </div>

        {/* TON Connect Wallet Section */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">💎</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                TON Wallet
              </div>
              <div className="text-xs font-mono text-cyan-300 truncate max-w-[140px]">
                {tonAddress ? `${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : 'Not Connected'}
              </div>
            </div>
          </div>

          <TonConnectButton className="scale-90 origin-right" />
        </div>
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
          Invite friends to Telegram Mini App and receive 10% of their tournament winnings directly into your balance!
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
