import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { UserInventoryGift } from '../../types/wallet.js';
import {
  Backpack,
  Gift,
  Sparkles,
  Coins,
  Trash2,
  Filter,
  ExternalLink,
  ChevronRight,
  Layers
} from 'lucide-react';

interface InventoryScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onOpenShop: () => void;
  onOpenGiftsCatalog?: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  user,
  setUser,
  onOpenShop,
  onOpenGiftsCatalog
}) => {
  const [activeTab, setActiveTab] = useState<'GIFTS' | 'RELICS'>('GIFTS');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [userGifts, setUserGifts] = useState<UserInventoryGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState<boolean>(false);

  // Fetch user gifts from server
  const loadUserGifts = async () => {
    try {
      setLoadingGifts(true);
      const res = await fetch(`/api/gifts/inventory?userId=${user.id}`);
      const data = await res.json();
      if (Array.isArray(data.gifts)) {
        setUserGifts(data.gifts);
      }
    } catch (e) {
      console.error('Failed to load user gifts:', e);
    } finally {
      setLoadingGifts(false);
    }
  };

  useEffect(() => {
    loadUserGifts();
  }, [user.id]);

  const rarities = [
    { id: 'all', label: 'All', color: '#ffffff' },
    { id: 'common', label: 'Common', color: '#94a3b8' },
    { id: 'rare', label: 'Rare', color: '#38bdf8' },
    { id: 'epic', label: 'Epic', color: '#a855f7' },
    { id: 'legendary', label: 'Legendary', color: '#eab308' }
  ];

  const filteredRelics = user.inventory.filter(r =>
    filterRarity === 'all' ? true : r.rarity === filterRarity
  );

  const totalRelicsValue = user.inventory.reduce((sum, r) => sum + r.value, 0);
  const totalGiftsValue = userGifts.reduce((sum, g) => sum + g.priceStars, 0);

  const handleSellRelic = (relicId: string, value: number) => {
    haptic.impact('medium');
    setUser(prev => ({
      ...prev,
      credits: +(prev.credits + value).toFixed(2),
      inventory: prev.inventory.filter(r => r.id !== relicId)
    }));
    sound.playClick();
    haptic.notification('success');
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* Header Stats */}
      <div className="rounded-3xl border border-white/10 bg-[#121422] p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
            🎒
          </div>
          <div>
            <div className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Stored Assets
            </div>
            <div className="text-lg font-black text-white">
              {userGifts.length} Gifts • {user.inventory.length} Relics
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-white/40 font-mono">Valuation</div>
          <div className="text-sm font-black font-mono text-[#ccff00]">
            {totalGiftsValue} ⭐ + {totalRelicsValue} 🪙
          </div>
        </div>
      </div>

      {/* Main Tab Toggle: Telegram Gifts vs Relics */}
      <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab('GIFTS');
          }}
          className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            activeTab === 'GIFTS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Telegram Gifts ({userGifts.length})</span>
        </button>

        <button
          onClick={() => {
            haptic.selection();
            setActiveTab('RELICS');
          }}
          className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            activeTab === 'RELICS'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Game Relics ({user.inventory.length})</span>
        </button>
      </div>

      {/* TAB 1: TELEGRAM GIFTS */}
      {activeTab === 'GIFTS' && (
        <div className="flex flex-col gap-3">
          {userGifts.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#121422] border border-dashed border-white/10 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">🎁</span>
              <div>
                <div className="text-xs font-bold text-white">No Telegram Gifts yet</div>
                <div className="text-[11px] text-white/50 mt-1">
                  Discover 149 gifts indexed from telegram_gifts.db in the catalog!
                </div>
              </div>

              {onOpenGiftsCatalog && (
                <button
                  onClick={() => {
                    haptic.selection();
                    onOpenGiftsCatalog();
                  }}
                  className="mt-2 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Browse Gifts Catalog</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userGifts.map(gift => (
                <div
                  key={gift.instanceId}
                  className="rounded-2xl border border-purple-500/30 bg-[#131626] p-3 flex flex-col justify-between gap-2 shadow-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{
                        backgroundColor: gift.backdropColor || '#3b82f6',
                        borderColor: gift.edgeColor || 'rgba(255,255,255,0.2)'
                      }}
                    >
                      🎁
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-white truncate">
                        {gift.name}
                      </div>
                      <div className="text-[10px] text-white/50 font-mono truncate">
                        Model: {gift.modelName || 'Standard'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-400 font-bold">
                      {gift.priceStars} ⭐
                    </span>
                    <span className="text-white/40 text-[9px]">
                      {new Date(gift.acquiredAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GAME RELICS */}
      {activeTab === 'RELICS' && (
        <div className="flex flex-col gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {rarities.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  haptic.selection();
                  setFilterRarity(r.id);
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  filterRarity === r.id
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-black/30 text-white/50 hover:text-white/80'
                }`}
                style={{
                  color: filterRarity === r.id ? r.color : undefined
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {filteredRelics.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#121422] border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
              <span className="text-2xl">📦</span>
              <div className="text-xs text-white/40 font-mono">
                No relics found in this category.
              </div>
              <button
                onClick={onOpenShop}
                className="mt-2 py-2 px-4 rounded-xl bg-[#ccff00] text-black font-black text-xs uppercase"
              >
                Open Cases in Games
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredRelics.map(relic => (
                <div
                  key={relic.id}
                  className="rounded-2xl border border-white/10 bg-[#121422] p-3 flex items-center justify-between gap-2 hover:border-white/20 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{relic.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {relic.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#ccff00]">
                        +{relic.value} 🪙
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSellRelic(relic.id, relic.value)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition"
                    title="Sell relic for credits"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
