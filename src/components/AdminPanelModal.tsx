import React, { useState, useEffect } from 'react';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import {
  X,
  Shield,
  Key,
  Database,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Server,
  Terminal,
  Send,
  Lock,
  Coins,
  Gamepad2,
  Users,
  Trophy,
  History,
  DollarSign,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const [activeTab, setActiveTab] = useState<'GAMES_CONTROL' | 'GAMES_HISTORY' | 'CONFIG' | 'DATABASE' | 'AUDIT'>('GAMES_CONTROL');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [depositAddress, setDepositAddress] = useState<string>('');
  const [hotWalletMnemonic, setHotWalletMnemonic] = useState<string>('');
  const [toncenterKey, setToncenterKey] = useState<string>('');
  const [botToken, setBotToken] = useState<string>('');
  const [isTestnet, setIsTestnet] = useState<boolean>(false);
  const [adminIds, setAdminIds] = useState<string>('');
  const [neonConn, setNeonConn] = useState<string>('');

  // Game rules & pricing states
  const [starsPriceUsd, setStarsPriceUsd] = useState<number>(0.0130);
  const [arenaBotRakePercent, setArenaBotRakePercent] = useState<number>(5.0);
  const [enabledGames, setEnabledGames] = useState<{
    arena: boolean;
    mines: boolean;
    crush: boolean;
    cases: boolean;
    bumper: boolean;
  }>({
    arena: true,
    mines: true,
    crush: true,
    cases: true,
    bumper: true
  });

  // Live Stats & Games History
  const [stats, setStats] = useState<any>(null);
  const [gamesHistory, setGamesHistory] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadStats();
      loadGamesHistory();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      if (data) {
        setDepositAddress(data.depositWalletAddress || '');
        setToncenterKey(data.toncenterApiKey || '');
        setBotToken(data.botStarsToken || '');
        setIsTestnet(Boolean(data.isTestnet));
        setAdminIds(Array.isArray(data.adminTelegramIds) ? data.adminTelegramIds.join(', ') : '');
        setNeonConn(data.neonConnectionString || '');
        if (typeof data.starsPriceUsd === 'number') setStarsPriceUsd(data.starsPriceUsd);
        if (typeof data.arenaBotRakePercent === 'number') setArenaBotRakePercent(data.arenaBotRakePercent);
        if (data.enabledGames) setEnabledGames(data.enabledGames);
      }
    } catch (err) {
      console.error('Error loading admin config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);

      const logsRes = await fetch('/api/admin/activity-logs');
      const logsData = await logsRes.json();
      if (Array.isArray(logsData.logs)) {
        setActivityLogs(logsData.logs);
      }
    } catch (err) {
      console.error('Error loading admin stats:', err);
    }
  };

  const loadGamesHistory = async () => {
    try {
      const res = await fetch('/api/admin/games-history?limit=50');
      const data = await res.json();
      if (Array.isArray(data.history)) {
        setGamesHistory(data.history);
      }
    } catch (err) {
      console.error('Error loading games history:', err);
    }
  };

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    try {
      sound.playClick();
      haptic.impact('heavy');
      setSaving(true);
      setMessage(null);

      const parsedAdminIds = adminIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const body: any = {
        depositWalletAddress: depositAddress.trim(),
        isTestnet,
        starsPriceUsd: Number(starsPriceUsd) || 0.0130,
        arenaBotRakePercent: Number(arenaBotRakePercent) || 5.0,
        enabledGames
      };

      if (hotWalletMnemonic.trim()) {
        body.hotWalletMnemonic = hotWalletMnemonic.trim();
      }
      if (toncenterKey.trim()) {
        body.toncenterApiKey = toncenterKey.trim();
      }
      if (botToken.trim()) {
        body.botStarsToken = botToken.trim();
      }
      if (neonConn.trim()) {
        body.neonConnectionString = neonConn.trim();
      }
      if (parsedAdminIds.length > 0) {
        body.adminTelegramIds = parsedAdminIds;
      }

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'System settings saved to Neon PostgreSQL & applied!' });
        sound.playVictory();
        haptic.notification('success');
        loadStats();
        loadGamesHistory();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleGame = (gameKey: keyof typeof enabledGames) => {
    sound.playClick();
    haptic.selection();
    setEnabledGames(prev => ({
      ...prev,
      [gameKey]: !prev[gameKey]
    }));
  };

  // Compute stats from gamesHistory
  const totalVolumeUsd = gamesHistory.reduce((s, g) => s + (g.betAmount || 0), 0);
  const totalPayoutsUsd = gamesHistory.reduce((s, g) => s + (g.payoutAmount || 0), 0);
  const totalRakeEarnedUsd = +(gamesHistory.reduce((s, g) => {
    const rake = g.gameDetails?.rakeTon || g.gameDetails?.rakeUsd || (g.payoutAmount * 0.05) || 0;
    return s + (typeof rake === 'number' ? rake : 0);
  }, 0)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0f111c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141829]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Operations & Admin Console</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ONLINE
                </span>
              </h2>
              <div className="text-[11px] text-white/50 font-mono">
                Admin: {userId} • Neon PostgreSQL Connected
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-[#0b0d17] overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('GAMES_CONTROL');
              haptic.selection();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'GAMES_CONTROL'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Games & Pricing</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('GAMES_HISTORY');
              haptic.selection();
              loadGamesHistory();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'GAMES_HISTORY'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Served Games ({gamesHistory.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('CONFIG');
              haptic.selection();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'CONFIG'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Wallet & Keys</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('DATABASE');
              haptic.selection();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'DATABASE'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Postgres DB</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('AUDIT');
              haptic.selection();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'AUDIT'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit & Logs</span>
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`px-4 py-2.5 mx-4 mt-3 rounded-2xl text-xs flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* TAB 1: GAMES & PRICING CONTROL */}
          {activeTab === 'GAMES_CONTROL' && (
            <div className="flex flex-col gap-4">
              {/* Telegram Stars & Bot Rake Configuration */}
              <div className="p-3.5 rounded-2xl bg-[#141727] border border-white/10 flex flex-col gap-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span>Currency Valuation & Game Rake Rules</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Stars Price Field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-white/60">
                      Telegram Stars Valuation (USD)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-amber-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.001"
                        value={starsPriceUsd}
                        onChange={e => setStarsPriceUsd(parseFloat(e.target.value) || 0.0130)}
                        className="w-full pl-7 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-amber-300 outline-none focus:border-amber-400"
                        placeholder="0.0130"
                      />
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">
                      Official Fragment Creator Cashout: ~$0.0130 – $0.0133
                    </span>
                  </div>

                  {/* Area Bot Rake Field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-white/60">
                      Area Game Bot Fee / Rake (%)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="25"
                        value={arenaBotRakePercent}
                        onChange={e => setArenaBotRakePercent(parseFloat(e.target.value) || 5.0)}
                        className="w-full pl-3 pr-7 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-cyan-300 outline-none focus:border-cyan-400"
                        placeholder="5.0"
                      />
                      <span className="absolute right-3 text-cyan-400 font-mono text-xs">%</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">
                      Winner pays 5% of winning pot to bot/house
                    </span>
                  </div>
                </div>
              </div>

              {/* Game Availability Toggles */}
              <div className="p-3.5 rounded-2xl bg-[#141727] border border-white/10 flex flex-col gap-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-purple-400" />
                    <span>Game Mode Availability Controls</span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">
                    Admin toggle to disable individual games
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Area PvP */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white">Area PvP Arena</div>
                      <div className="text-[10px] text-white/40 font-mono">Multiplayer 2D jackpot wheel</div>
                    </div>
                    <button
                      onClick={() => toggleGame('arena')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        enabledGames.arena
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {enabledGames.arena ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Mines PvE */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white">Mines PvE</div>
                      <div className="text-[10px] text-white/40 font-mono">Tile uncovering game</div>
                    </div>
                    <button
                      onClick={() => toggleGame('mines')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        enabledGames.mines
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {enabledGames.mines ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Crush Rocket */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white">Crush Rocket</div>
                      <div className="text-[10px] text-white/40 font-mono">Multiplier flight cashout</div>
                    </div>
                    <button
                      onClick={() => toggleGame('crush')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        enabledGames.crush
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {enabledGames.crush ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Cases Unboxing */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white">Cases Unboxing</div>
                      <div className="text-[10px] text-white/40 font-mono">Crate unboxing for relics</div>
                    </div>
                    <button
                      onClick={() => toggleGame('cases')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        enabledGames.cases
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {enabledGames.cases ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Bump Sumo Arena */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 sm:col-span-2">
                    <div>
                      <div className="text-xs font-bold text-white">Bump Sumo Arena</div>
                      <div className="text-[10px] text-white/40 font-mono">Sumo ring collision multiplayer</div>
                    </div>
                    <button
                      onClick={() => toggleGame('bumper')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        enabledGames.bumper
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {enabledGames.bumper ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Game Rules & Toggles</span>
              </button>
            </div>
          )}

          {/* TAB 2: SERVED GAMES HISTORY & FINANCIALS */}
          {activeTab === 'GAMES_HISTORY' && (
            <div className="flex flex-col gap-3.5">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Games Served</div>
                  <div className="text-lg font-black text-white mt-1">
                    {gamesHistory.length}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Total Volume (USD)</div>
                  <div className="text-lg font-black text-cyan-300 mt-1">
                    ${totalVolumeUsd.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Bot Rake (5%)</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    ${totalRakeEarnedUsd}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Player Payouts</div>
                  <div className="text-lg font-black text-amber-400 mt-1">
                    ${totalPayoutsUsd.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-white px-1">
                  <span>Served Game Rounds & Financial Records</span>
                  <button
                    onClick={loadGamesHistory}
                    className="text-[10px] text-cyan-400 flex items-center gap-1 hover:underline font-mono"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {gamesHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40 font-mono border border-dashed border-white/10 rounded-2xl">
                    No served game rounds recorded yet in Neon PostgreSQL.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                    {gamesHistory.map((game: any) => {
                      const mode = game.gameId || 'arena';
                      const details = game.gameDetails || {};
                      const winnerName = details.winnerUsername || details.survivor || game.userId;
                      const rakeAmount = details.rakeTon ? `${details.rakeTon} TON` : (details.rakeStars ? `${details.rakeStars} ⭐` : '5%');

                      return (
                        <div
                          key={game.id}
                          className="p-3 rounded-2xl bg-[#131627] border border-white/5 flex flex-col gap-1.5 text-xs hover:border-white/10 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] uppercase">
                                {mode}
                              </span>
                              <span className="font-mono text-white font-bold">
                                {game.id}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ✓ Credited In-App
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1 border-t border-white/5">
                            <div>
                              <span className="text-white/40 block text-[9px]">WINNER</span>
                              <span className="text-white font-bold truncate block">{winnerName}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px]">WAGER / POT</span>
                              <span className="text-white font-bold">
                                {details.totalTon ? `${details.totalTon} TON` : `${game.betAmount} USD`}
                              </span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px]">WINNER PAYOUT</span>
                              <span className="text-emerald-400 font-bold">
                                {details.payoutTon ? `${details.payoutTon} TON` : `${game.payoutAmount} USD`}
                              </span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px]">BOT 5% RAKE</span>
                              <span className="text-cyan-300 font-bold">
                                {rakeAmount}
                              </span>
                            </div>
                          </div>

                          <div className="text-[9px] text-white/40 font-mono">
                            {new Date(game.createdAt).toLocaleString()} • Server Seed Hash: {game.serverSeedHash ? `${game.serverSeedHash.slice(0, 16)}...` : 'Verified'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONFIG & KEYS */}
          {activeTab === 'CONFIG' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Deposit Target Wallet Address (TON)
                </label>
                <input
                  type="text"
                  value={depositAddress}
                  onChange={e => setDepositAddress(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-cyan-300 outline-none"
                  placeholder="EQBvW8Z5huBkMJYdnF64PT5fqJZW2elETRRFFsA-b281bf20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  TonCenter API Key (Mainnet)
                </label>
                <input
                  type="text"
                  value={toncenterKey}
                  onChange={e => setToncenterKey(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-white outline-none"
                  placeholder="4b6bd05c1bb6b913cd8790c8400f2d4f43845cc0117ceaff5f16466d651f3323"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Telegram Bot Stars Token (BotFather)
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-amber-300 outline-none"
                  placeholder="8903710651:AAEGEg0vKNsPOV62yc2reqv_EqCLckKsI2Y"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white">Network Environment</div>
                  <div className="text-[10px] text-white/40 font-mono">
                    {isTestnet ? 'TON Testnet (testnet.toncenter.com)' : 'TON Mainnet (toncenter.com)'}
                  </div>
                </div>
                <button
                  onClick={() => setIsTestnet(!isTestnet)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    isTestnet
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isTestnet ? 'Testnet' : 'Mainnet'}
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Admin Telegram IDs (comma-separated, Cloud Run secret ADMIN_ID)
                </label>
                <input
                  type="text"
                  value={adminIds}
                  onChange={e => setAdminIds(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-white outline-none"
                  placeholder="8903710651, mojolojo275"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50 mt-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Configuration</span>
              </button>
            </div>
          )}

          {/* TAB 4: DATABASE (NEON POSTGRES) */}
          {activeTab === 'DATABASE' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200">
                  <div className="font-bold flex items-center gap-2">
                    <span>Neon PostgreSQL Connection</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-black uppercase">
                      Connected
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-1 leading-relaxed">
                    Primary productive database for ACID ledgers, balances, bets, claims, and activity logs.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Postgres Connection String (Neon)
                </label>
                <input
                  type="text"
                  value={neonConn}
                  onChange={e => setNeonConn(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-cyan-300 outline-none"
                  placeholder="postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require"
                />
              </div>

              {/* Database Overview Cards */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Registered Users</div>
                  <div className="text-lg font-black text-white mt-1">
                    {stats?.neonStats?.totalUsers ?? '...'}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Total Transactions</div>
                  <div className="text-lg font-black text-[#ccff00] mt-1">
                    {stats?.neonStats?.totalTransactions ?? '...'}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Total Games Played</div>
                  <div className="text-lg font-black text-cyan-400 mt-1">
                    {stats?.neonStats?.totalGamesPlayed ?? '...'}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Task Claims Recorded</div>
                  <div className="text-lg font-black text-purple-400 mt-1">
                    {stats?.neonStats?.totalTaskClaims ?? '...'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 mt-1"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Database Settings</span>
              </button>
            </div>
          )}

          {/* TAB 5: AUDIT LEDGER & ACTIVITY LOGS */}
          {activeTab === 'AUDIT' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-white/40 mb-1.5">
                  Recent User & System Activity Logs (Neon Postgres)
                </div>
                {activityLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/40 font-mono border border-dashed border-white/10 rounded-2xl">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-3">
                    {activityLogs.slice(0, 15).map((log: any) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-emerald-400 truncate font-bold">
                            {log.action} <span className="text-white/50 text-[10px]">({log.userId})</span>
                          </div>
                          <div className="text-[9px] text-white/40 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString()} • {JSON.stringify(log.details)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-white/40 mb-1.5">
                  Recent Ledger Transactions
                </div>
                {!stats?.recentTransactions || stats.recentTransactions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/40 font-mono border border-dashed border-white/10 rounded-2xl">
                    No transactions recorded yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {stats.recentTransactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-white/80 truncate">
                            {tx.type} • {tx.userId}
                          </div>
                          <div className="text-[9px] text-white/40 font-mono">
                            {new Date(tx.createdAt).toLocaleString()} • {tx.status}
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-cyan-300">
                          {tx.amountTon ? `${tx.amountTon} TON` : ''}
                          {tx.amountStars ? `${tx.amountStars} ⭐` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
