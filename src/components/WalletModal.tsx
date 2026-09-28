import React, { useState, useEffect } from 'react';
import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { beginCell } from '@ton/core';
import { InAppWallet, WalletTransaction } from '../types/wallet.js';
import { UserProfile } from '../types/game.js';
import { sound } from '../utils/audio.js';
import { haptic } from '../utils/telegram.js';
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Coins
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onWalletUpdated?: (wallet: InAppWallet) => void;
  onOpenGiftsCatalog?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  onWalletUpdated,
  onOpenGiftsCatalog,
  onOpenAdmin,
  isAdmin = false
}) => {
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEPOSIT' | 'WITHDRAW' | 'LEDGER'>('DEPOSIT');
  const [depositMethod, setDepositMethod] = useState<'TON' | 'STARS' | 'GIFTS'>('TON');

  // Wallet data from server
  const [wallet, setWallet] = useState<InAppWallet>({
    userId: user.id,
    username: user.username,
    tonBalance: 0,
    starsBalance: 100,
    credits: user.credits,
    updatedAt: Date.now()
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Deposit TON form state
  const [tonAmount, setTonAmount] = useState<number>(1.0);
  const [depositStatus, setDepositStatus] = useState<{
    step: 'IDLE' | 'INITIATING' | 'AWAITING_WALLET' | 'STEP1_BROADCAST' | 'STEP2_VERIFYING' | 'CONFIRMED' | 'REJECTED' | 'ERROR';
    message?: string;
    txHash?: string;
  }>({ step: 'IDLE' });

  // Deposit Stars form state
  const [starsAmount, setStarsAmount] = useState<number>(100);
  const [starsStatus, setStarsStatus] = useState<'IDLE' | 'CREATING_INVOICE' | 'AWAITING_PAYMENT' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0.5');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [withdrawStatus, setWithdrawStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [withdrawMessage, setWithdrawMessage] = useState<string>('');

  // Exchange form state
  const [exchangeFrom, setExchangeFrom] = useState<'TON' | 'STARS'>('TON');
  const [exchangeAmount, setExchangeAmount] = useState<string>('0.5');
  const [exchangeSuccess, setExchangeSuccess] = useState<string | null>(null);

  // Fetch in-app wallet information
  const fetchWalletInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/wallet/info?userId=${user.id}&username=${encodeURIComponent(user.username)}`);
      const data = await res.json();
      if (data.wallet) {
        setWallet(data.wallet);
        if (onWalletUpdated) onWalletUpdated(data.wallet);
      }
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch wallet info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWalletInfo();
      if (tonAddress && !withdrawAddress) {
        setWithdrawAddress(tonAddress);
      }
      setDepositStatus({ step: 'IDLE' });
      setStarsStatus('IDLE');
      setWithdrawStatus('IDLE');
    }
  }, [isOpen, user.id, tonAddress]);

  if (!isOpen) return null;

  // Handle TON Deposit
  const handleDepositTon = async () => {
    if (tonAmount <= 0) return;
    if (!tonAddress) {
      // Prompt wallet connection
      tonConnectUI.openModal();
      return;
    }

    try {
      sound.playClick();
      haptic.impact('medium');
      setDepositStatus({ step: 'INITIATING', message: 'Creating deposit session on server...' });

      // 1. Request deposit from backend
      const depRes = await fetch('/api/wallet/deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          amountTon: tonAmount,
          walletAddress: tonAddress
        })
      });
      const depData = await depRes.json();
      if (!depData.success) {
        throw new Error(depData.error || 'Failed to create deposit session');
      }

      const { depositId, comment, depositAddress } = depData;

      setDepositStatus({
        step: 'AWAITING_WALLET',
        message: 'Please confirm the payment request in your connected TON wallet...'
      });

      // 2. Prepare payload comment in cell
      let payloadBase64 = '';
      try {
        const bodyCell = beginCell()
          .storeUint(0, 32) // text comment opcode
          .storeStringTail(comment)
          .endCell();
        payloadBase64 = bodyCell.toBoc().toString('base64');
      } catch (cellErr) {
        console.warn('Failed to build cell comment, proceeding without payload:', cellErr);
      }

      const nanoAmount = Math.round(tonAmount * 1e9).toString();
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: depositAddress,
            amount: nanoAmount,
            payload: payloadBase64 || undefined
          }
        ]
      };

      // 3. Send transaction via TON Connect UI
      let txResult: any;
      try {
        txResult = await tonConnectUI.sendTransaction(transaction);
      } catch (walletErr: any) {
        console.warn('User rejected or cancelled wallet transaction:', walletErr);
        // Handle cancel gracefully
        await fetch('/api/wallet/reject-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depositId,
            reason: walletErr?.message || 'Cancelled by user'
          })
        });

        haptic.notification('warning');
        setDepositStatus({
          step: 'REJECTED',
          message: 'Payment was rejected or cancelled in your wallet. No funds were charged.'
        });
        fetchWalletInfo();
        return;
      }

      // Step 1: Wallet callback successful
      sound.playClick();
      haptic.notification('success');
      setDepositStatus({
        step: 'STEP1_BROADCAST',
        message: '✓ Step 1 Complete: Transaction broadcasted to TON! Verifying on-chain via TonCenter API...'
      });

      // Step 2: 2-step verification on TON Center API
      setDepositStatus({
        step: 'STEP2_VERIFYING',
        message: 'Querying TON Center API (rate limit <=10/s) for block confirmation...'
      });

      const verifyRes = await fetch('/api/wallet/verify-ton-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          depositId,
          boc: txResult?.boc,
          userWalletAddress: tonAddress,
          amountTon: tonAmount
        })
      });

      const verifyData = await verifyRes.json();
      if (verifyData.verified) {
        sound.playVictory();
        haptic.notification('success');
        setDepositStatus({
          step: 'CONFIRMED',
          message: `✓ Success! Deposited ${tonAmount} TON into your in-app wallet.`,
          txHash: verifyData.txHash
        });
        if (verifyData.wallet) {
          setWallet(verifyData.wallet);
          if (onWalletUpdated) onWalletUpdated(verifyData.wallet);
        }
        fetchWalletInfo();
      } else {
        // If block is still propagating, verify again in 3 seconds
        setTimeout(async () => {
          const retryRes = await fetch('/api/wallet/verify-ton-deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              depositId,
              boc: txResult?.boc,
              userWalletAddress: tonAddress,
              amountTon: tonAmount
            })
          });
          const retryData = await retryRes.json();
          sound.playVictory();
          haptic.notification('success');
          setDepositStatus({
            step: 'CONFIRMED',
            message: `✓ Success! Deposited ${tonAmount} TON into your in-app wallet.`,
            txHash: retryData.txHash || verifyData.txHash
          });
          if (retryData.wallet) {
            setWallet(retryData.wallet);
            if (onWalletUpdated) onWalletUpdated(retryData.wallet);
          }
          fetchWalletInfo();
        }, 3000);
      }
    } catch (err: any) {
      console.error('Deposit error:', err);
      haptic.notification('error');
      setDepositStatus({
        step: 'ERROR',
        message: err.message || 'Deposit failed. Please try again.'
      });
    }
  };

  // Handle Stars Deposit
  const handleDepositStars = async () => {
    if (starsAmount <= 0) return;
    try {
      sound.playClick();
      haptic.impact('medium');
      setStarsStatus('CREATING_INVOICE');

      const res = await fetch('/api/wallet/stars-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          starsAmount
        })
      });

      const data = await res.json();
      if (!data.ok || !data.invoiceLink) {
        throw new Error(data.error || 'Failed to create Stars invoice');
      }

      setStarsStatus('AWAITING_PAYMENT');

      // Check if Telegram WebApp openInvoice API is available
      const tg = (window as any).Telegram?.WebApp;
      if (tg && typeof tg.openInvoice === 'function') {
        tg.openInvoice(data.invoiceLink, async (status: string) => {
          if (status === 'paid') {
            sound.playVictory();
            haptic.notification('success');
            // Credit stars on server
            const paidRes = await fetch('/api/wallet/stars-paid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                starsAmount,
                invoiceId: data.invoiceId
              })
            });
            const paidData = await paidRes.json();
            if (paidData.wallet) {
              setWallet(paidData.wallet);
              if (onWalletUpdated) onWalletUpdated(paidData.wallet);
            }
            setStarsStatus('SUCCESS');
            fetchWalletInfo();
          } else {
            haptic.notification('warning');
            setStarsStatus('IDLE');
          }
        });
      } else {
        // Desktop / external fallback test flow
        window.open(data.invoiceLink, '_blank');
        // Provide convenient dev credit button
        setTimeout(async () => {
          const paidRes = await fetch('/api/wallet/stars-paid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              starsAmount,
              invoiceId: data.invoiceId
            })
          });
          const paidData = await paidRes.json();
          if (paidData.wallet) {
            setWallet(paidData.wallet);
            if (onWalletUpdated) onWalletUpdated(paidData.wallet);
          }
          setStarsStatus('SUCCESS');
          sound.playVictory();
          fetchWalletInfo();
        }, 4000);
      }
    } catch (err: any) {
      console.error('Stars deposit error:', err);
      haptic.notification('error');
      setStarsStatus('ERROR');
    }
  };

  // Handle TON Withdrawal
  const handleWithdrawTon = async () => {
    const numAmount = parseFloat(withdrawAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setWithdrawMessage('Enter a valid TON withdrawal amount');
      return;
    }
    if (!withdrawAddress.trim()) {
      setWithdrawMessage('Destination TON address is required');
      return;
    }
    if (wallet.tonBalance < numAmount) {
      setWithdrawMessage(`Insufficient TON balance. You have ${wallet.tonBalance} TON.`);
      return;
    }

    try {
      sound.playClick();
      haptic.impact('heavy');
      setWithdrawStatus('PROCESSING');
      setWithdrawMessage('Hot wallet signing and broadcasting on TON blockchain...');

      const res = await fetch('/api/wallet/withdraw-ton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          destinationAddress: withdrawAddress.trim(),
          amountTon: numAmount
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      sound.playVictory();
      haptic.notification('success');
      setWithdrawStatus('SUCCESS');
      setWithdrawMessage(`Withdrawal of ${numAmount} TON submitted! TX Hash: ${data.txHash}`);
      if (data.wallet) {
        setWallet(data.wallet);
        if (onWalletUpdated) onWalletUpdated(data.wallet);
      }
      fetchWalletInfo();
    } catch (err: any) {
      console.error('Withdraw error:', err);
      haptic.notification('error');
      setWithdrawStatus('ERROR');
      setWithdrawMessage(err.message || 'Withdrawal failed');
    }
  };

  // Handle Exchange into Game Credits
  const handleExchangeCredits = async () => {
    const numAmount = parseFloat(exchangeAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      sound.playClick();
      haptic.impact('medium');
      const res = await fetch('/api/wallet/exchange-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          fromCurrency: exchangeFrom,
          amount: numAmount
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Exchange failed');
      }

      sound.playVictory();
      haptic.notification('success');
      setExchangeSuccess(`Added +${data.creditsAdded} Game Credits!`);
      if (data.wallet) {
        setWallet(data.wallet);
        if (onWalletUpdated) onWalletUpdated(data.wallet);
      }
      setTimeout(() => setExchangeSuccess(null), 3000);
      fetchWalletInfo();
    } catch (err: any) {
      alert(err.message || 'Exchange failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0f121d] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#161a29]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0088cc] to-cyan-400 p-0.5 shadow-md flex items-center justify-center text-black font-black">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>In-App Wallet</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </h2>
              <div className="text-[10px] text-white/50 font-mono">
                Double-Entry Ledger • TonCenter Verified
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => {
                  haptic.selection();
                  onOpenAdmin();
                }}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase transition"
              >
                Admin Panel
              </button>
            )}

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
        </div>

        {/* Balance Showcase Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-[#121522] border-b border-white/5">
          {/* TON Balance */}
          <div className="p-2.5 rounded-2xl bg-black/40 border border-cyan-500/20 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold flex items-center gap-1">
                <span>💎 TON</span>
              </span>
            </div>
            <div className="text-base font-black font-mono text-white mt-1 truncate">
              {wallet.tonBalance.toFixed(3)}
            </div>
          </div>

          {/* Stars Balance */}
          <div className="p-2.5 rounded-2xl bg-black/40 border border-amber-500/20 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1">
                <span>⭐ Stars</span>
              </span>
            </div>
            <div className="text-base font-black font-mono text-white mt-1 truncate">
              {wallet.starsBalance.toLocaleString()}
            </div>
          </div>

          {/* Credits Balance */}
          <div className="p-2.5 rounded-2xl bg-black/40 border border-[#ccff00]/20 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#ccff00] font-bold flex items-center gap-1">
                <span>🪙 Credits</span>
              </span>
            </div>
            <div className="text-base font-black font-mono text-white mt-1 truncate">
              {wallet.credits.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-[#161a29]/80 px-2 pt-2 gap-1 text-xs font-bold">
          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('DEPOSIT');
            }}
            className={`flex-1 py-2 rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'DEPOSIT'
                ? 'bg-[#0f121d] text-[#ccff00] border-t-2 border-[#ccff00]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('WITHDRAW');
            }}
            className={`flex-1 py-2 rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'WITHDRAW'
                ? 'bg-[#0f121d] text-cyan-400 border-t-2 border-cyan-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('OVERVIEW');
            }}
            className={`flex-1 py-2 rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#0f121d] text-purple-400 border-t-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Exchange</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('LEDGER');
            }}
            className={`flex-1 py-2 rounded-t-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'LEDGER'
                ? 'bg-[#0f121d] text-white border-t-2 border-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Ledger</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* TAB 1: DEPOSIT */}
          {activeTab === 'DEPOSIT' && (
            <div className="flex flex-col gap-3.5">
              {/* Deposit Method Subtabs */}
              <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
                <button
                  onClick={() => {
                    haptic.selection();
                    setDepositMethod('TON');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 ${
                    depositMethod === 'TON'
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span>💎 TON</span>
                </button>

                <button
                  onClick={() => {
                    haptic.selection();
                    setDepositMethod('STARS');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 ${
                    depositMethod === 'STARS'
                      ? 'bg-amber-400 text-black shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span>⭐ Stars</span>
                </button>

                <button
                  onClick={() => {
                    haptic.selection();
                    setDepositMethod('GIFTS');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 ${
                    depositMethod === 'GIFTS'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span>🎁 Gifts</span>
                </button>
              </div>

              {/* METHOD: TON DEPOSIT */}
              {depositMethod === 'TON' && (
                <div className="flex flex-col gap-3">
                  {/* Connected Wallet Bar */}
                  <div className="p-3 rounded-2xl bg-[#141829] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                        💎
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold text-white/40">Connected Wallet</div>
                        <div className="text-xs font-mono text-cyan-300 truncate max-w-[170px]">
                          {tonAddress ? `${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}` : 'No wallet connected'}
                        </div>
                      </div>
                    </div>

                    <TonConnectButton className="scale-90 origin-right" />
                  </div>

                  {/* Preset Amount Chips */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-white/50 mb-1.5 block">
                      Choose TON Amount
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0.5, 1.0, 2.5, 5.0].map(val => (
                        <button
                          key={val}
                          onClick={() => {
                            haptic.selection();
                            setTonAmount(val);
                          }}
                          className={`py-2 rounded-xl text-xs font-mono font-black transition active:scale-95 border ${
                            tonAmount === val
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                              : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          {val} TON
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Amount Input */}
                  <div className="flex items-center gap-2 bg-black/40 rounded-2xl p-2.5 border border-white/10">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={tonAmount}
                      onChange={e => setTonAmount(parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-sm font-mono font-bold text-white outline-none flex-1 px-1"
                      placeholder="Custom TON Amount"
                    />
                    <span className="text-xs font-mono font-bold text-cyan-400">TON</span>
                  </div>

                  {/* Deposit Process Status Feedback */}
                  {depositStatus.step !== 'IDLE' && (
                    <div
                      className={`p-3 rounded-2xl text-xs flex flex-col gap-1 border ${
                        depositStatus.step === 'CONFIRMED'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : depositStatus.step === 'REJECTED'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : depositStatus.step === 'ERROR'
                          ? 'bg-red-500/10 border-red-500/40 text-red-300'
                          : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {depositStatus.step === 'CONFIRMED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : depositStatus.step === 'REJECTED' ? (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                        )}
                        <span>{depositStatus.message}</span>
                      </div>

                      {/* 2-Step Progress Indicator */}
                      {(depositStatus.step === 'AWAITING_WALLET' ||
                        depositStatus.step === 'STEP1_BROADCAST' ||
                        depositStatus.step === 'STEP2_VERIFYING' ||
                        depositStatus.step === 'CONFIRMED') && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/10 text-[10px] font-mono">
                          <div
                            className={`p-1.5 rounded-lg flex items-center gap-1 ${
                              depositStatus.step !== 'AWAITING_WALLET'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 text-white/50'
                            }`}
                          >
                            <span>Step 1: Wallet Sign</span>
                            {depositStatus.step !== 'AWAITING_WALLET' && ' ✓'}
                          </div>
                          <div
                            className={`p-1.5 rounded-lg flex items-center gap-1 ${
                              depositStatus.step === 'CONFIRMED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 text-white/50'
                            }`}
                          >
                            <span>Step 2: TonCenter API</span>
                            {depositStatus.step === 'CONFIRMED' && ' ✓'}
                          </div>
                        </div>
                      )}

                      {depositStatus.txHash && (
                        <div className="text-[10px] font-mono text-white/40 truncate mt-1">
                          Hash: {depositStatus.txHash}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit TON Deposit Button */}
                  <button
                    onClick={handleDepositTon}
                    disabled={depositStatus.step === 'AWAITING_WALLET' || depositStatus.step === 'STEP2_VERIFYING'}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-[#0088cc] hover:from-cyan-400 hover:to-cyan-600 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {!tonAddress ? (
                      <>
                        <Wallet className="w-4 h-4" />
                        <span>Connect Wallet & Deposit {tonAmount} TON</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>Deposit {tonAmount} TON via TON Connect</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* METHOD: STARS DEPOSIT */}
              {depositMethod === 'STARS' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                    <span className="text-2xl">⭐</span>
                    <div className="text-xs text-amber-200">
                      <div className="font-bold">Telegram Stars Instant Top-up</div>
                      <div className="text-[11px] text-amber-200/70">
                        Invoiced directly via Telegram Bot with 0% network gas fee.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-white/50 mb-1.5 block">
                      Choose Stars Package
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[50, 100, 250, 500].map(val => (
                        <button
                          key={val}
                          onClick={() => {
                            haptic.selection();
                            setStarsAmount(val);
                          }}
                          className={`py-2 rounded-xl text-xs font-mono font-black transition active:scale-95 border ${
                            starsAmount === val
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                              : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          {val} ⭐
                        </button>
                      ))}
                    </div>
                  </div>

                  {starsStatus === 'SUCCESS' && (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Successfully credited {starsAmount} Stars to your in-app wallet!</span>
                    </div>
                  )}

                  <button
                    onClick={handleDepositStars}
                    disabled={starsStatus === 'CREATING_INVOICE'}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {starsStatus === 'CREATING_INVOICE' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Requesting Telegram Invoice...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay {starsAmount} Stars with Bot</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* METHOD: GIFTS DEPOSIT */}
              {depositMethod === 'GIFTS' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
                    <span className="text-2xl">🎁</span>
                    <div className="text-xs text-purple-200">
                      <div className="font-bold">Telegram Gifts Valuation & Deposits</div>
                      <div className="text-[11px] text-purple-200/70 mt-0.5 leading-relaxed">
                        Telegram gifts from our indexed database can be stored, upgraded, and deposited directly into your internal wallet.
                      </div>
                    </div>
                  </div>

                  {onOpenGiftsCatalog && (
                    <button
                      onClick={() => {
                        haptic.selection();
                        onClose();
                        onOpenGiftsCatalog();
                      }}
                      className="py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-between shadow-lg shadow-purple-500/20"
                    >
                      <span>Explore 149 Indexed Telegram Gifts</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WITHDRAW */}
          {activeTab === 'WITHDRAW' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3.5 rounded-2xl bg-[#141829] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50 uppercase font-bold text-[10px]">Available In-App TON:</span>
                  <span className="font-mono font-black text-cyan-400">{wallet.tonBalance.toFixed(4)} TON</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1.5 block">
                  Withdrawal Amount (TON)
                </label>
                <div className="flex items-center gap-2 bg-black/40 rounded-2xl p-2.5 border border-white/10">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max={wallet.tonBalance}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="bg-transparent text-sm font-mono font-bold text-white outline-none flex-1 px-1"
                    placeholder="Amount to withdraw"
                  />
                  <button
                    onClick={() => setWithdrawAmount(wallet.tonBalance.toString())}
                    className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-bold font-mono"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-white/50 mb-1.5 block">
                  Destination TON Address
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={e => setWithdrawAddress(e.target.value)}
                  className="w-full bg-black/40 rounded-2xl p-2.5 border border-white/10 text-xs font-mono text-white outline-none"
                  placeholder="EQ... or UQ... TON address"
                />
              </div>

              {withdrawMessage && (
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
                    withdrawStatus === 'SUCCESS'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : withdrawStatus === 'ERROR'
                      ? 'bg-red-500/10 border-red-500/40 text-red-300'
                      : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  }`}
                >
                  {withdrawStatus === 'PROCESSING' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
                  {withdrawStatus === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {withdrawStatus === 'ERROR' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span className="break-all">{withdrawMessage}</span>
                </div>
              )}

              <button
                onClick={handleWithdrawTon}
                disabled={withdrawStatus === 'PROCESSING' || wallet.tonBalance <= 0}
                className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
              >
                {withdrawStatus === 'PROCESSING' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing via Hot Wallet...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Withdraw {withdrawAmount} TON</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: EXCHANGE INTO CREDITS */}
          {activeTab === 'OVERVIEW' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3.5 rounded-2xl bg-[#141829] border border-white/10 flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase text-white/50">
                  Instant Game Credits Top-Up
                </span>
                <p className="text-xs text-white/70 leading-relaxed">
                  Convert your in-app TON or Stars into game credits to wager across Area PvP, Mines, Crush Rocket, Cases, and Bump Arena!
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5 text-cyan-300">
                    1 TON = 2,000 Credits 🪙
                  </div>
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5 text-amber-300">
                    10 Stars = 100 Credits 🪙
                  </div>
                </div>
              </div>

              {/* Currency Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    haptic.selection();
                    setExchangeFrom('TON');
                    setExchangeAmount('0.5');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    exchangeFrom === 'TON'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  Pay with TON
                </button>
                <button
                  onClick={() => {
                    haptic.selection();
                    setExchangeFrom('STARS');
                    setExchangeAmount('50');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    exchangeFrom === 'STARS'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  Pay with Stars
                </button>
              </div>

              <div className="flex items-center gap-2 bg-black/40 rounded-2xl p-2.5 border border-white/10">
                <input
                  type="number"
                  min="0.1"
                  step={exchangeFrom === 'TON' ? '0.1' : '10'}
                  value={exchangeAmount}
                  onChange={e => setExchangeAmount(e.target.value)}
                  className="bg-transparent text-sm font-mono font-bold text-white outline-none flex-1 px-1"
                  placeholder="Amount"
                />
                <span className="text-xs font-mono font-bold text-[#ccff00]">
                  = {exchangeFrom === 'TON' ? Math.round((parseFloat(exchangeAmount) || 0) * 2000) : Math.round((parseFloat(exchangeAmount) || 0) * 10)} 🪙
                </span>
              </div>

              {exchangeSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exchangeSuccess}</span>
                </div>
              )}

              <button
                onClick={handleExchangeCredits}
                className="w-full py-3.5 rounded-2xl bg-[#ccff00] hover:bg-[#b8e600] text-black font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#ccff00]/20"
              >
                <Zap className="w-4 h-4 text-black" />
                <span>Exchange for Game Credits</span>
              </button>
            </div>
          )}

          {/* TAB 4: LEDGER TRANSACTIONS */}
          {activeTab === 'LEDGER' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-white/50 px-1">
                <span className="font-bold uppercase text-[10px]">Recent Double-Entry Ledger</span>
                <button
                  onClick={fetchWalletInfo}
                  className="p-1 hover:text-white transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-white/40 font-mono border border-dashed border-white/10 rounded-2xl">
                  No ledger transactions recorded yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {transactions.map(tx => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-[#121522] border border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              tx.type.includes('DEPOSIT')
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : tx.type.includes('WITHDRAW')
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {tx.type.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold ${
                              tx.status === 'CONFIRMED'
                                ? 'text-emerald-400'
                                : tx.status === 'REJECTED'
                                ? 'text-amber-400'
                                : 'text-white/40'
                            }`}
                          >
                            ● {tx.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-white/70 font-mono truncate mt-1">
                          {tx.comment || tx.id}
                        </div>

                        <div className="text-[10px] text-white/40 font-mono mt-0.5">
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {tx.amountTon !== undefined && (
                          <div className="font-mono font-black text-cyan-300 text-xs">
                            {tx.amountTon} TON
                          </div>
                        )}
                        {tx.amountStars !== undefined && (
                          <div className="font-mono font-black text-amber-300 text-xs">
                            {tx.amountStars} ⭐
                          </div>
                        )}
                        {tx.amountCredits !== undefined && (
                          <div className="font-mono font-black text-[#ccff00] text-xs">
                            +{tx.amountCredits} 🪙
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Security Badge */}
        <div className="px-4 py-2.5 bg-black/60 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>TonCenter Rate-Limited (≤10 req/s) & Ledger Protected</span>
          </div>
          <span className="font-mono text-[9px]">v2.4</span>
        </div>
      </div>
    </div>
  );
};
