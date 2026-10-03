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
  Users
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
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'HOT_WALLET' | 'DATABASE' | 'STATS' | 'AUDIT'>('CONFIG');
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

  // Live Stats
  const [stats, setStats] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadStats();
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
        isTestnet
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
        setMessage({ type: 'success', text: 'System configuration updated & saved to database!' });
        sound.playVictory();
        haptic.notification('success');
        loadStats();
      } else {
        throw new Error(data.error || 'Failed to update configuration');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Save failed' });
      sound.playBettingClosed();
      haptic.notification('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg bg-[#0e111a] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-black to-blue-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                Production Control Center
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  LIVE
                </span>
              </h2>
              <p className="text-[11px] text-white/50 font-mono">Neon PostgreSQL & On-Chain Hub</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-5 p-2 bg-black/40 border-b border-white/5 text-[10px] font-bold uppercase tracking-wider gap-1">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('CONFIG');
            }}
            className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${
              activeTab === 'CONFIG' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('DATABASE');
            }}
            className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${
              activeTab === 'DATABASE' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Neon DB</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('HOT_WALLET');
            }}
            className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${
              activeTab === 'HOT_WALLET' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Hot Wallet</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('STATS');
              loadStats();
            }}
            className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${
              activeTab === 'STATS' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Metrics</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('AUDIT');
              loadStats();
            }}
            className={`py-2 rounded-xl transition flex flex-col items-center gap-1 ${
              activeTab === 'AUDIT' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 text-white">
          {message && (
            <div
              className={`p-3 rounded-2xl mb-4 text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* TAB: CONFIG */}
          {activeTab === 'CONFIG' && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Deposit Receiver TON Address
                </label>
                <input
                  type="text"
                  value={depositAddress}
                  onChange={e => setDepositAddress(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-2.5 text-xs font-mono text-cyan-300 outline-none"
                  placeholder="EQBvW8Z5huBkMJYdnF64PT5fqJZW2elETRRFFsA-b281bf20"
                />
                <span className="text-[10px] text-white/40 font-mono mt-1 block">
                  User TON deposits are directed to this on-chain address with unique comment tag.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  TonCenter API Key
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
                  Telegram Bot Token (Stars Invoicing)
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
                  Admin Telegram IDs (comma-separated)
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
                <span>Save Admin Configuration</span>
              </button>
            </div>
          )}

          {/* TAB: DATABASE (NEON POSTGRES) */}
          {activeTab === 'DATABASE' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200">
                  <div className="font-bold flex items-center gap-2">
                    <span>Neon PostgreSQL Connection</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-black uppercase">
                      Active
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

          {/* TAB: HOT WALLET */}
          {activeTab === 'HOT_WALLET' && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-2.5">
                <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-cyan-200">
                  <div className="font-bold">Automated Hot Wallet for TON Withdrawals</div>
                  <p className="text-[11px] text-cyan-200/70 mt-1 leading-relaxed">
                    Set up your 12 or 24 secret recovery words. When a user requests a TON withdrawal, the hot wallet automatically signs and broadcasts the transfer to their destination address via TonCenter API.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1 block">
                  Hot Wallet Secret Words (12 or 24 words)
                </label>
                <textarea
                  rows={3}
                  value={hotWalletMnemonic}
                  onChange={e => setHotWalletMnemonic(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-xs font-mono text-white outline-none placeholder-white/30"
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                />
                <span className="text-[10px] text-white/40 font-mono mt-1 block">
                  Stored securely and referenced for instant automated user payouts.
                </span>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Update Hot Wallet Keys</span>
              </button>
            </div>
          )}

          {/* TAB: STATS & RATE LIMITER */}
          {activeTab === 'STATS' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Rate Limit</div>
                  <div className="text-base font-black font-mono text-[#ccff00] mt-1">10 req/s</div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Available Tokens</div>
                  <div className="text-base font-black font-mono text-cyan-400 mt-1">
                    {stats?.rateLimiter?.availableTokens ?? 10} / 10
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Calls Handled</div>
                  <div className="text-base font-black font-mono text-white mt-1">
                    {stats?.rateLimiter?.totalCalls ?? 0}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#131627] border border-white/10 flex flex-col gap-2">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Neon PostgreSQL Engine</span>
                  <span className="text-emerald-400 text-[10px] font-mono font-bold">CONNECTED</span>
                </div>
                <div className="text-[11px] font-mono text-white/60">
                  Pool: ep-lingering-river-b5z4kwub-pooler
                </div>
              </div>

              <button
                onClick={loadStats}
                className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Live Metrics</span>
              </button>
            </div>
          )}

          {/* TAB: AUDIT LEDGER & ACTIVITY LOGS */}
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
