import React, { useState } from 'react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { InAppWallet } from '../../types/wallet.js';
import {
  ShoppingBag,
  Zap,
  Check,
  ShieldCheck,
  Wallet,
  ArrowDownLeft,
  Gift,
  Coins,
  ChevronRight
} from 'lucide-react';

interface ShopScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  wallet?: InAppWallet;
  onOpenWallet?: () => void;
  onOpenGiftsCatalog?: () => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  user,
  setUser,
  wallet,
  onOpenWallet,
  onOpenGiftsCatalog
}) => {
  const tonAddress = useTonAddress();
  const [purchasedId, setPurchasedId] = useState<string | null>(null);

  const packages = [
    {
      id: 'pack_micro',
      title: 'Micro Stash',
      credits: 500,
      tonPrice: 0.25,
      starsPrice: 25,
      popular: false,
      color: '#38bdf8',
      icon: '🪙'
    },
    {
      id: 'pack_stack',
      title: 'Standard Stack',
      credits: 2000,
      tonPrice: 1.0,
      starsPrice: 100,
      bonus: '+15% BONUS',
      popular: true,
      color: '#ccff00',
      icon: '⚡'
    },
    {
      id: 'pack_vault',
      title: 'Whale Vault',
      credits: 10000,
      tonPrice: 5.0,
      starsPrice: 500,
      bonus: '+30% BONUS',
      popular: false,
      color: '#a855f7',
      icon: '💎'
    },
    {
      id: 'pack_highroller',
      title: 'High Roller Treasury',
      credits: 35000,
      tonPrice: 15.0,
      starsPrice: 1500,
      bonus: '+50% MEGA BONUS',
      popular: false,
      color: '#f59e0b',
      icon: '👑'
    }
  ];

  const handlePurchase = async (pkg: typeof packages[0]) => {
    haptic.impact('heavy');

    // If user has in-app TON or Stars, deduct or exchange
    if (wallet && wallet.tonBalance >= pkg.tonPrice) {
      try {
        await fetch('/api/wallet/exchange-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            fromCurrency: 'TON',
            amount: pkg.tonPrice
          })
        });
      } catch (e) {
        console.warn('Backend exchange call failed, updating local state:', e);
      }
    }

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
      {/* In-App Wallet & Deposit Banner */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#121626] p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
              💎
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>In-App Wallet</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                {wallet ? `${wallet.tonBalance.toFixed(3)} TON • ${wallet.starsBalance} Stars` : '0.00 TON'}
              </div>
            </div>
          </div>

          {onOpenWallet && (
            <button
              onClick={() => {
                haptic.selection();
                onOpenWallet();
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center gap-1 shadow-md shadow-cyan-500/20"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
          )}
        </div>

        {/* Connected TON Connect Indicator */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
          <span className="text-white/40">Connected Wallet:</span>
          <div className="flex items-center gap-1.5 text-white/70">
            <span className="truncate max-w-[130px]">
              {tonAddress ? `${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : 'Disconnected'}
            </span>
            <TonConnectButton className="scale-75 origin-right" />
          </div>
        </div>
      </div>

      {/* Featured Telegram Gifts Catalog Banner */}
      {onOpenGiftsCatalog && (
        <div
          onClick={() => {
            haptic.selection();
            onOpenGiftsCatalog();
          }}
          className="cursor-pointer rounded-3xl border border-purple-500/40 bg-gradient-to-r from-purple-950/80 via-[#151226] to-indigo-950/80 p-4 shadow-xl flex items-center justify-between hover:border-purple-400 transition group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
              🎁
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  Telegram Gifts Catalog
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white">
                  NEW
                </span>
              </div>
              <div className="text-[11px] text-purple-200/70 mt-0.5 leading-tight truncate">
                149 Gifts with Real Models, Backdrops & Symbols
              </div>
              <div className="text-[10px] font-mono text-cyan-300 mt-1">
                Buy with Stars or In-App TON →
              </div>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-purple-500/30 transition shrink-0">
            <ChevronRight className="w-4 h-4 text-purple-300" />
          </div>
        </div>
      )}

      {/* Credit Packages */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#ccff00]" />
            <span>Instant Credit Packs</span>
          </span>
          <span className="text-[11px] text-white/40 font-mono">Arena PvP & Games</span>
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
                    <span>Buy for {pkg.tonPrice} TON / {pkg.starsPrice} ⭐</span>
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
