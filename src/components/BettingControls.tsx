import React, { useState, useEffect } from 'react';
import { CurrentRoundState, Relic, UserProfile } from '../types/game.js';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import { Plus, X, Gem, RotateCcw, AlertCircle, Clock } from 'lucide-react';

interface BettingControlsProps {
  roundState: CurrentRoundState;
  user: UserProfile;
  selectedRelics: Relic[];
  onOpenRelicPicker: () => void;
  onRemoveRelic: (id: string) => void;
  onPlaceBet: (currency: 'ton' | 'stars', amount: number, relics: Relic[]) => void;
  onCancelBet?: () => void;
  onStartRound?: () => void;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
  roundState,
  user,
  selectedRelics,
  onOpenRelicPicker,
  onRemoveRelic,
  onPlaceBet,
  onCancelBet,
  onStartRound
}) => {
  const [currency, setCurrency] = useState<'ton' | 'stars'>('ton');
  const [betInput, setBetInput] = useState<string>('0.5');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Live rates for conversion
  const [tonPriceUsd, setTonPriceUsd] = useState<number>(1.515);
  const [starsPriceUsd, setStarsPriceUsd] = useState<number>(0.0130);

  useEffect(() => {
    fetch('/api/rates')
      .then(r => r.json())
      .then(d => {
        if (d.tonPriceUsd) setTonPriceUsd(d.tonPriceUsd);
        if (d.starsPriceUsd) setStarsPriceUsd(d.starsPriceUsd);
      })
      .catch(() => {});
  }, []);

  const canBet = 
    (roundState.status === 'WAITING_FOR_PLAYERS' || roundState.status === 'BETTING_OPEN') && 
    !roundState.isBettingClosed && 
    (roundState.status === 'WAITING_FOR_PLAYERS' || roundState.timeRemainingMs > 3000);

  const userBet = roundState.bets.find(b => b.playerId === user.id);
  const numericAmount = Math.max(0, parseFloat(betInput || '0'));

  const userTonBalance = user.tonBalance || 0;
  const userStarsBalance = user.starsBalance || 0;

  const currentBalance = currency === 'ton' ? userTonBalance : userStarsBalance;
  const isInsufficient = numericAmount > currentBalance;

  // USD equivalent calculation
  const usdValue = currency === 'ton'
    ? +(numericAmount * tonPriceUsd).toFixed(2)
    : +(numericAmount * starsPriceUsd).toFixed(2);

  const relicsValue = selectedRelics.reduce((sum, r) => sum + r.value, 0);
  const totalBetUsd = +(usdValue + relicsValue).toFixed(2);

  // Quick preset chips
  const tonPresets = [0.1, 0.25, 0.5, 1.0, 2.0];
  const starsPresets = [10, 25, 50, 100, 250];

  const handleCurrencyChange = (newCurr: 'ton' | 'stars') => {
    sound.playClick();
    haptic.selection();
    setCurrency(newCurr);
    setBetInput(newCurr === 'ton' ? '0.5' : '50');
  };

  const handlePreset = (amount: number | 'max') => {
    sound.playClick();
    haptic.selection();
    if (amount === 'max') {
      const maxVal = currency === 'ton' ? userTonBalance.toFixed(2) : userStarsBalance.toString();
      setBetInput(maxVal);
    } else {
      setBetInput(amount.toString());
    }
  };

  const handlePlace = () => {
    if (!canBet || numericAmount <= 0 || isInsufficient) return;

    sound.playBetPlaced();
    haptic.impact('medium');
    setIsPlacing(true);
    onPlaceBet(currency, numericAmount, selectedRelics);
    setTimeout(() => setIsPlacing(false), 500);
  };

  const handleCancelClick = async () => {
    if (!onCancelBet || isCancelling) return;
    sound.playClick();
    haptic.notification('warning');
    setIsCancelling(true);
    await onCancelBet();
    setIsCancelling(false);
  };

  // 1-Player Waiting Logic & Cancel Countdown
  const isOnlyPlayerWaiting =
    userBet &&
    roundState.bets.length === 1 &&
    roundState.status === 'WAITING_FOR_PLAYERS';

  const cancelRemainingSec = roundState.firstBetPlacedAt
    ? Math.max(0, Math.ceil((60000 - (Date.now() - roundState.firstBetPlacedAt)) / 1000))
    : 0;

  return (
    <div className="flex flex-col gap-2.5 bg-[#12141f]/95 p-3 rounded-2xl border border-white/10 shadow-lg">
      {/* Active Bet & Cancel Bet Banner */}
      {userBet && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs">
          <div className="flex items-center justify-between text-cyan-300">
            <span className="font-semibold flex items-center gap-1.5">
              <span>✓ Active Bet in Pot:</span>
              <span className="font-mono font-bold text-white">
                {userBet.tonAmount > 0 && `${userBet.tonAmount} TON`}
                {userBet.tonAmount > 0 && userBet.starsAmount > 0 && ' + '}
                {userBet.starsAmount > 0 && `${userBet.starsAmount} ⭐`}
                <span className="text-cyan-400/70 text-[11px] ml-1">
                  (≈ ${userBet.betValueUSD.toFixed(2)} USD)
                </span>
              </span>
            </span>

            {roundState.bets.length >= 2 ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                PvP Match Active
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" />
                Waiting for 2nd Player
              </span>
            )}
          </div>

          {/* Cancel Bet Action if alone in round */}
          {isOnlyPlayerWaiting && onCancelBet && (
            <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20 text-[11px]">
              <span className="text-white/60">
                {cancelRemainingSec > 0 ? (
                  <span>Auto-cancellable in <strong className="text-amber-400 font-mono">{cancelRemainingSec}s</strong> if no one joins</span>
                ) : (
                  <span>No one joined yet. You can cancel your bet anytime!</span>
                )}
              </span>

              <button
                onClick={handleCancelClick}
                disabled={isCancelling}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[11px] transition active:scale-95 flex items-center gap-1"
                title="Cancel your bet and refund funds directly to in-app wallet"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isCancelling ? 'Refunding...' : 'Cancel Bet & Refund'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Currency Switcher: TON vs Telegram Stars */}
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div className="flex items-center gap-1.5 p-0.5 bg-black/40 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => handleCurrencyChange('ton')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              currency === 'ton'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>💎</span>
            <span>TON</span>
          </button>

          <button
            type="button"
            onClick={() => handleCurrencyChange('stars')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              currency === 'stars'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>⭐</span>
            <span>Stars</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-white/50 text-right">
          <span>In-App Balance: </span>
          <strong className="text-white">
            {currency === 'ton' ? `${userTonBalance.toFixed(2)} TON` : `${userStarsBalance.toLocaleString()} ⭐`}
          </strong>
        </div>
      </div>

      {/* Quick Amount Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <span className="text-[11px] text-white/40 flex-shrink-0 mr-1 font-medium">
          Quick:
        </span>
        {(currency === 'ton' ? tonPresets : starsPresets).map(amt => (
          <button
            key={amt}
            disabled={!canBet}
            onClick={() => handlePreset(amt)}
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition ${
              numericAmount === amt
                ? currency === 'ton'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                  : 'bg-amber-400/20 text-amber-300 border-amber-400/60'
                : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
            }`}
          >
            {amt} {currency === 'ton' ? 'TON' : '⭐'}
          </button>
        ))}
        <button
          disabled={!canBet}
          onClick={() => handlePreset('max')}
          className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20 transition"
        >
          Max
        </button>
      </div>

      {/* Selected Relics Chips */}
      {selectedRelics.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-[#181a28] border border-white/5">
          <span className="text-[11px] text-purple-300 font-semibold flex-shrink-0">
            Depositing Relics (+${relicsValue} USD):
          </span>
          {selectedRelics.map(relic => (
            <div
              key={relic.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 border text-xs"
              style={{ borderColor: relic.color }}
            >
              <span>{relic.icon}</span>
              <span className="text-[11px] text-white">{relic.name}</span>
              <button
                onClick={() => onRemoveRelic(relic.id)}
                className="text-white/40 hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Controls Row: Input + Place Button + Add Relic */}
      <div className="grid grid-cols-12 gap-2">
        {/* Custom Input with Live USD conversion */}
        <div className="col-span-5 flex flex-col justify-center">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-sm">
              {currency === 'ton' ? '💎' : '⭐'}
            </span>
            <input
              type="number"
              min="0"
              step={currency === 'ton' ? '0.1' : '1'}
              disabled={!canBet}
              value={betInput}
              onChange={e => setBetInput(e.target.value)}
              className="w-full pl-8 pr-2 py-2 rounded-xl bg-[#181b29] border border-white/10 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-400 transition"
              placeholder="Amount"
            />
          </div>
          <div className="text-[10px] font-mono text-white/40 pl-1 mt-0.5 truncate">
            ≈ ${usdValue.toFixed(2)} USD
          </div>
        </div>

        {/* Add Relic Button */}
        <button
          onClick={onOpenRelicPicker}
          disabled={!canBet}
          className="col-span-3 flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#1f2233] hover:bg-[#272b40] disabled:opacity-40 text-white rounded-xl border border-white/10 text-xs font-bold transition active:scale-95"
        >
          <Gem className="w-3.5 h-3.5 text-purple-400" />
          <span className="truncate">Relic</span>
          {selectedRelics.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">
              {selectedRelics.length}
            </span>
          )}
        </button>

        {/* Place Bet CTA Button */}
        <button
          onClick={handlePlace}
          disabled={!canBet || numericAmount <= 0 || isInsufficient || isPlacing}
          className={`col-span-4 py-2 px-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide uppercase transition shadow-lg active:scale-95 flex flex-col items-center justify-center ${
            !canBet
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : isInsufficient
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-not-allowed'
              : currency === 'ton'
              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:brightness-110 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
              : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
          }`}
        >
          {!canBet ? (
            <span>Betting Closed</span>
          ) : isInsufficient ? (
            <span>Low Balance</span>
          ) : (
            <>
              <span>Place Bet</span>
              <span className="font-mono text-[10px] opacity-90">
                ({numericAmount} {currency === 'ton' ? 'TON' : '⭐'})
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
