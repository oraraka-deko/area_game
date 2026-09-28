import React, { useState, useEffect } from 'react';
import { TelegramGiftItem, TelegramGiftTrait } from '../types/wallet.js';
import { UserProfile } from '../types/game.js';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import {
  X,
  Gift,
  Sparkles,
  Search,
  CheckCircle2,
  Layers,
  Palette,
  Tag,
  Coins,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface GiftsCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onGiftPurchased?: () => void;
}

export const GiftsCatalogModal: React.FC<GiftsCatalogModalProps> = ({
  isOpen,
  onClose,
  user,
  onGiftPurchased
}) => {
  const [gifts, setGifts] = useState<TelegramGiftItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [upgradeableOnly, setUpgradeableOnly] = useState<boolean>(false);
  const [selectedGift, setSelectedGift] = useState<TelegramGiftItem | null>(null);

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen, upgradeableOnly]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/gifts/catalog?limit=149&upgradeableOnly=${upgradeableOnly}`);
      const data = await res.json();
      if (Array.isArray(data.gifts)) {
        setGifts(data.gifts);
      }
    } catch (err) {
      console.error('Error fetching gifts catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredGifts = gifts.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.gift_id.includes(search)
  );

  const handleBuyGift = async (gift: TelegramGiftItem, currency: 'stars' | 'ton') => {
    try {
      sound.playClick();
      haptic.impact('heavy');
      setBuyingId(gift.gift_id);
      setBuyError(null);

      const res = await fetch('/api/gifts/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          giftId: gift.gift_id,
          currency
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to purchase gift');
      }

      sound.playVictory();
      haptic.notification('success');
      setBuySuccess(`Acquired ${gift.name}! Added to your Inventory.`);
      if (onGiftPurchased) onGiftPurchased();
      setTimeout(() => setBuySuccess(null), 3500);
    } catch (err: any) {
      sound.playClick();
      haptic.notification('error');
      setBuyError(err.message || 'Purchase failed');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0e111c] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#151928]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 shadow-md flex items-center justify-center text-white">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Telegram Gifts Catalog</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {gifts.length} ITEMS
                </span>
              </h2>
              <div className="text-[10px] text-white/50 font-mono">
                Indexed from telegram_gifts.db • Real Models & Rarities
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.selection();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 bg-[#111422] border-b border-white/5 flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search gifts by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                haptic.selection();
                setUpgradeableOnly(!upgradeableOnly);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                upgradeableOnly
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Upgradeable Only</span>
            </button>

            <button
              onClick={loadCatalog}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition"
              title="Refresh Catalog"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {buySuccess && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{buySuccess}</span>
          </div>
        )}
        {buyError && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <X className="w-4 h-4 shrink-0 text-red-400" />
            <span>{buyError}</span>
          </div>
        )}

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full py-16 text-center flex flex-col items-center justify-center gap-2 text-white/40">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-xs font-mono">Loading Telegram Gifts from Database...</span>
            </div>
          ) : filteredGifts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-white/40 font-mono">
              No gifts match your search query.
            </div>
          ) : (
            filteredGifts.map(gift => {
              const bgGradient =
                gift.sample_backdrops?.[0]?.center_color || '#312e81';
              const topModel = gift.sample_models?.[0]?.name || 'Gift Model';

              return (
                <div
                  key={gift.gift_id}
                  className="rounded-2xl border border-white/10 bg-[#131625] overflow-hidden flex flex-col justify-between hover:border-purple-500/40 transition group"
                >
                  {/* Visual Artwork Box */}
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${bgGradient}33, #0f121e)`
                    }}
                    className="p-4 relative flex flex-col items-center justify-center min-h-[110px]"
                  >
                    {/* Upgradeable Pill */}
                    {gift.is_upgradeable && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white shadow-sm flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Upgradeable</span>
                        </span>
                      </div>
                    )}

                    <div className="text-3xl mb-1 group-hover:scale-110 transition duration-300">
                      🎁
                    </div>
                    <div className="text-xs font-black text-white text-center truncate max-w-[90%]">
                      {gift.name}
                    </div>
                    <div className="text-[10px] text-white/50 font-mono">
                      {topModel}
                    </div>
                  </div>

                  {/* Attributes Summary */}
                  <div className="p-3 flex flex-col gap-2.5 bg-[#121422]">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span>⭐ {gift.price_stars}</span>
                      </span>
                      <span className="text-cyan-300 font-bold">
                        {(gift.price_stars / 100).toFixed(2)} TON
                      </span>
                    </div>

                    {/* Trait counts */}
                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
                      <div className="p-1 rounded bg-black/30 border border-white/5 text-white/60">
                        {gift.model_count} Models
                      </div>
                      <div className="p-1 rounded bg-black/30 border border-white/5 text-white/60">
                        {gift.backdrop_count} Drops
                      </div>
                      <div className="p-1 rounded bg-black/30 border border-white/5 text-white/60">
                        {gift.symbol_count} Symbols
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <button
                        onClick={() => handleBuyGift(gift, 'stars')}
                        disabled={buyingId === gift.gift_id}
                        className="py-1.5 px-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <span>Buy {gift.price_stars} ⭐</span>
                      </button>

                      <button
                        onClick={() => handleBuyGift(gift, 'ton')}
                        disabled={buyingId === gift.gift_id}
                        className="py-1.5 px-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase transition active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <span>Buy {(gift.price_stars / 100).toFixed(2)} TON</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        haptic.selection();
                        setSelectedGift(gift);
                      }}
                      className="w-full py-1 text-center text-[10px] text-white/40 hover:text-white/80 font-mono transition"
                    >
                      Inspect Traits & Rarity →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Gift Trait Inspector Modal */}
        {selectedGift && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#131627] border border-purple-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedGift.name}</h3>
                    <div className="text-[10px] font-mono text-white/50">ID: {selectedGift.gift_id}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGift(null)}
                  className="p-1 rounded-lg bg-white/5 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <div className="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span>3D Models & Rarities ({selectedGift.model_count} total)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGift.sample_models.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-[10px] font-mono text-white/80 flex items-center gap-1.5"
                      >
                        <span>{m.name}</span>
                        {m.rarity && (
                          <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[8px]">
                            {m.rarity}‰
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-emerald-400" />
                    <span>Backdrop Color Palettes ({selectedGift.backdrop_count} total)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGift.sample_backdrops.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-[10px] font-mono text-white/80 flex items-center gap-1.5"
                      >
                        {b.center_color && (
                          <span
                            className="w-3 h-3 rounded-full border border-white/20 inline-block"
                            style={{ backgroundColor: b.center_color }}
                          />
                        )}
                        <span>{b.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" />
                    <span>Symbols ({selectedGift.symbol_count} total)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGift.sample_symbols.slice(0, 8).map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded bg-black/40 border border-white/5 text-[10px] font-mono text-white/70"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex gap-2">
                <button
                  onClick={() => {
                    handleBuyGift(selectedGift, 'stars');
                    setSelectedGift(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase"
                >
                  Buy with {selectedGift.price_stars} Stars
                </button>
                <button
                  onClick={() => {
                    handleBuyGift(selectedGift, 'ton');
                    setSelectedGift(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-black font-black text-xs uppercase"
                >
                  Buy with {(selectedGift.price_stars / 100).toFixed(2)} TON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
