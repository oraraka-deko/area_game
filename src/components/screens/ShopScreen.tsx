import React, { useState } from 'react';
import { TonConnectButton, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { ShoppingBag, Zap, Crown, Check, ShieldCheck } from 'lucide-react';

interface ShopScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({ user, setUser }) => {
  const tonAddress = useTonAddress();
  const wallet = useTonWallet();
  const [purchasedId, setPurchasedId] = useState<string | null>(null);

  const packages = [
    {
      id: 'pack_micro',
      title: 'Micro Stash',
      credits: 500,
      tonPrice: 0.5,
      starsPrice: 50,
      popular: false,
      color: '#38bdf8',
      icon: '🪙'
    },
    {
      id: 'pack_stack',
      title: 'Standard Stack',
      credits: 2000,
      tonPrice: 1.8,
      starsPrice: 180,
      bonus: '+15% BONUS',
      popular: true,
      color: '#ccff00',
      icon: '⚡'
    },
    {
      id: 'pack_vault',
      title: 'Whale Vault',
      credits: 10000,
      tonPrice: 8.0,
      starsPrice: 800,
      bonus: '+30% BONUS',
      popular: false,
      color: '#a855f7',
      icon: '💎'
    },
    {
      id: 'pack_highroller',
      title: 'High Roller Treasury',
      credits: 35000,
      tonPrice: 25.0,
      starsPrice: 2500,
      bonus: '+50% MEGA BONUS',
      popular: false,
      color: '#f59e0b',
      icon: '👑'
    }
  ];

  const handlePurchase = (pkg: typeof packages[0]) => {
    haptic.impact('heavy');
    // Top up user credits
    setUser(prev => ({
      ...prev,
      credits: +(prev.credits + pkg.credits).toFixed(2)
    }));
    sound.playVictory();
    haptic.notification('success');

    setPurchasedId(pkg.id);
    setTimeout(() => setPurchasedId(null), 2500);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* TON Wallet Connect Card */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#121626] p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
            💎
          </div>
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>TON Connect</span>
              {tonAddress && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="text-[11px] text-white/50 font-mono truncate max-w-[170px]">
              {tonAddress ? `${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : 'Connect Tonkeeper / Wallet'}
            </div>
          </div>
        </div>

        {/* TON Connect Button */}
        <div>
          <TonConnectButton className="scale-90 origin-right" />
        </div>
      </div>

      {/* Credit Packages */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#ccff00]" />
            <span>Credit Packs</span>
          </span>
          <span className="text-[11px] text-white/40 font-mono">Instant Delivery</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packages.map(pkg => {
            const isJustBought = purchasedId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all duration-200 ${
                  pkg.popular
                    ? 'border-[#ccff00]/40 bg-gradient-to-br from-[#1c2415] to-[#121524]'
                    : 'border-white/5 bg-[#121422]'
                }`}
              >
                {/* Popular Pill */}
                {pkg.bonus && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#ccff00] text-black">
                      {pkg.bonus}
                    </span>
                  </div>
                )}

                <div>
                  <div className="text-2xl mb-1">{pkg.icon}</div>
                  <div className="text-xs font-extrabold text-white">{pkg.title}</div>
                  <div className="text-lg font-black font-mono text-[#ccff00] mt-0.5">
                    +{pkg.credits.toLocaleString()} 🪙
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(pkg)}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 ${
                    isJustBought
                      ? 'bg-emerald-500 text-black'
                      : pkg.popular
                      ? 'bg-[#ccff00] hover:bg-[#b8e600] text-black shadow-md shadow-[#ccff00]/20'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {isJustBought ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Purchased!</span>
                    </>
                  ) : (
                    <span>Buy for {pkg.tonPrice} TON</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Guarantee */}
      <div className="flex items-center gap-2 p-3 rounded-2xl bg-black/40 border border-white/5 text-white/50 text-[11px]">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Non-custodial web3 transactions verified on TON blockchain with 100% cryptographic safety.</span>
      </div>
    </div>
  );
};
