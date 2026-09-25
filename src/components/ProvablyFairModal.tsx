import React, { useState, useEffect } from 'react';
import { CurrentRoundState, RoundHistoryItem } from '../types/game.js';
import { verifyClientSide, ClientVerificationResult } from '../utils/math.js';
import { ShieldCheck, Copy, Check, X, RefreshCw } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface ProvablyFairModalProps {
  roundState: CurrentRoundState;
  historicalRound?: RoundHistoryItem | null;
  onClose: () => void;
}

export const ProvablyFairModal: React.FC<ProvablyFairModalProps> = ({
  roundState,
  historicalRound,
  onClose
}) => {
  const roundId = historicalRound ? historicalRound.roundId : roundState.roundId;
  const claimedHash = historicalRound ? historicalRound.provablyFair.seedHash : roundState.serverSeedHash;
  const serverSeed = historicalRound ? historicalRound.provablyFair.serverSeed : (roundState.revealedServerSeed || '');
  const totalPool = historicalRound ? historicalRound.totalPool : roundState.totalPool;
  const players = historicalRound ? [] : roundState.bets;

  const [inputSeed, setInputSeed] = useState(serverSeed);
  const [inputRoundId, setInputRoundId] = useState(roundId.toString());
  const [inputPool, setInputPool] = useState(totalPool.toString());
  const [result, setResult] = useState<ClientVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const runVerification = async () => {
    sound.playClick();
    if (!inputSeed) return;
    setLoading(true);

    try {
      const playerList = players.map(p => ({
        playerId: p.playerId,
        username: p.username,
        totalBet: p.totalBet
      }));

      const res = await verifyClientSide(
        inputSeed.trim(),
        claimedHash,
        parseInt(inputRoundId, 10) || roundId,
        parseFloat(inputPool) || totalPool,
        playerList
      );
      setResult(res);
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverSeed) {
      setInputSeed(serverSeed);
      runVerification();
    }
  }, [serverSeed]);

  const copyVal = (key: string, val: string) => {
    sound.playClick();
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#12141f] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Provably Fair Verifier</h3>
              <p className="text-xs text-white/50">HMAC-SHA256 Cryptographic Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps Explanation (Matches Screenshot 7) */}
        <div className="my-4 space-y-3">
          {/* Step 1 */}
          <div className="p-3 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#ccff00] text-black text-[10px] font-black flex items-center justify-center">1</span>
                <span>Pre-Game Hash Commitment</span>
              </div>
              <button
                onClick={() => copyVal('hash', claimedHash)}
                className="text-white/40 hover:text-white"
              >
                {copiedKey === 'hash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-white/50 mb-1.5">
              Generated and published before bets opened:
            </p>
            <div className="font-mono text-[11px] text-emerald-300 break-all bg-black/40 p-2 rounded-lg border border-white/5 select-all">
              {claimedHash}
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#ccff00] text-black text-[10px] font-black flex items-center justify-center">2</span>
                <span>Revealed Server Seed</span>
              </div>
              {serverSeed && (
                <button
                  onClick={() => copyVal('seed', serverSeed)}
                  className="text-white/40 hover:text-white"
                >
                  {copiedKey === 'seed' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/50 mb-1.5">
              Secret pre-image revealed upon round resolution:
            </p>
            {serverSeed ? (
              <div className="font-mono text-[11px] text-cyan-300 break-all bg-black/40 p-2 rounded-lg border border-white/5 select-all">
                {serverSeed}
              </div>
            ) : (
              <div className="text-xs text-amber-400/80 italic p-2 bg-amber-500/5 rounded-lg border border-amber-500/20">
                🔒 Seed is currently secret. It will be revealed automatically when the round completes.
              </div>
            )}
          </div>

          {/* Step 3: Interactive Calculation Form */}
          <div className="p-3 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-2">
              <span className="w-5 h-5 rounded-full bg-[#ccff00] text-black text-[10px] font-black flex items-center justify-center">3</span>
              <span>Outcome Formula Verification</span>
            </div>
            <p className="text-[11px] text-white/50 mb-2">
              <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">HMAC-SHA256(server_seed, round_id) mod totalPool</code>
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-white/40">Server Seed:</label>
                <input
                  type="text"
                  value={inputSeed}
                  onChange={e => setInputSeed(e.target.value)}
                  placeholder="Paste 64-char server seed"
                  className="w-full mt-0.5 p-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#ccff00]/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40">Round ID:</label>
                  <input
                    type="number"
                    value={inputRoundId}
                    onChange={e => setInputRoundId(e.target.value)}
                    className="w-full mt-0.5 p-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#ccff00]/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40">Total Pool (🪙):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputPool}
                    onChange={e => setInputPool(e.target.value)}
                    className="w-full mt-0.5 p-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#ccff00]/60"
                  />
                </div>
              </div>

              <button
                onClick={runVerification}
                disabled={!inputSeed || loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Recalculate & Verify</span>
              </button>
            </div>

            {/* Results Panel */}
            {result && (
              <div className={`mt-3 p-3 rounded-xl border ${result.hashMatches ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
                  {result.hashMatches ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Verification Passed: 100% Match!</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-rose-400" />
                      <span className="text-rose-300">Hash Mismatch: Invalid Seed!</span>
                    </>
                  )}
                </div>

                <div className="space-y-1 text-[11px] font-mono text-white/70">
                  <div>
                    <span className="text-white/40">SHA-256(seed): </span>
                    <span className="text-white break-all">{result.calculatedHash}</span>
                  </div>
                  <div>
                    <span className="text-white/40">Winning Ticket: </span>
                    <span className="text-[#ccff00] font-bold">{result.winningValue}</span>
                  </div>
                  {result.winningPlayerUsername && (
                    <div>
                      <span className="text-white/40">Winner Slice: </span>
                      <span className="text-cyan-300 font-bold">{result.winningPlayerUsername}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#ccff00] text-black font-extrabold text-xs uppercase tracking-wide hover:bg-[#b8e600] transition active:scale-98"
        >
          Close Verifier
        </button>
      </div>
    </div>
  );
};
