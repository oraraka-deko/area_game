import React, { useState, useEffect, useRef } from 'react';
import {
  CurrentRoundState,
  RoundHistoryItem,
  ChatMessage,
  UserProfile,
  Relic
} from './types/game.js';
import { Header } from './components/Header.js';
import { PoolInfo } from './components/PoolInfo.js';
import { TerritoryCanvas } from './components/TerritoryCanvas.js';
import { BettingControls } from './components/BettingControls.js';
import { PlayerRoster } from './components/PlayerRoster.js';
import { HistoryTab } from './components/HistoryTab.js';
import { VictoryModal } from './components/VictoryModal.js';
import { ProvablyFairModal } from './components/ProvablyFairModal.js';
import { HowItWorksModal } from './components/HowItWorksModal.js';
import { RelicInventoryModal } from './components/RelicInventoryModal.js';
import { PrivateRoomModal } from './components/PrivateRoomModal.js';
import { LiveChat } from './components/LiveChat.js';
import { RoundReplayModal } from './components/RoundReplayModal.js';
import { DevControls } from './components/DevControls.js';
import { GameHub, GameId } from './components/GameHub.js';
import { BottomNav, NavTab } from './components/BottomNav.js';
import { MinesGame } from './components/games/MinesGame.js';
import { CasesGame } from './components/games/CasesGame.js';
import { CrushGame } from './components/games/CrushGame.js';
import { BumpArenaGame } from './components/games/BumpArenaGame.js';
import { TasksScreen } from './components/screens/TasksScreen.js';
import { ShopScreen } from './components/screens/ShopScreen.js';
import { InventoryScreen } from './components/screens/InventoryScreen.js';
import { ProfileScreen } from './components/screens/ProfileScreen.js';
import { WalletModal } from './components/WalletModal.js';
import { GiftsCatalogModal } from './components/GiftsCatalogModal.js';
import { AdminPanelModal } from './components/AdminPanelModal.js';
import { InAppWallet } from './types/wallet.js';
import { sound } from './utils/audio.js';
import { safeStorage } from './utils/storage.js';
import { recordGameOutcome } from './utils/gameRecord.js';
import {
  initTelegramApp,
  getTelegramUser,
  setupTelegramBackButton,
  haptic
} from './utils/telegram.js';

// Default starting user profile (Starts with zero TON and zero Stars until deposited)
const INITIAL_USER: UserProfile = {
  id: 'usr_om3sgry',
  username: 'NeoGlitch',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  credits: 0,
  tonBalance: 0,
  starsBalance: 0,
  inventory: [],
  stats: {
    roundsPlayed: 0,
    roundsWon: 0,
    totalWagered: 0,
    biggestWin: 0
  }
};

export default function App() {
  // Navigation & Game State
  const [currentTab, setCurrentTab] = useState<NavTab>('games');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
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

  // User state
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = safeStorage.getItem('arena_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_USER,
          ...parsed,
          tonBalance: parsed.tonBalance !== undefined ? parsed.tonBalance : 1.5,
          starsBalance: parsed.starsBalance !== undefined ? parsed.starsBalance : 150
        };
      } catch (e) {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  // Load Game Modes Config
  useEffect(() => {
    fetch('/api/games/config')
      .then(r => r.json())
      .then(d => {
        if (d.enabledGames) {
          setEnabledGames(d.enabledGames);
        }
      })
      .catch(() => {});
  }, []);

  // Telegram WebApp Initialization
  useEffect(() => {
    initTelegramApp();
    const tgUser = getTelegramUser();
    if (tgUser) {
      setUser(prev => ({
        ...prev,
        id: tgUser.id,
        username: tgUser.username,
        avatar: tgUser.avatar
      }));
    }
  }, []);

  // In-App Wallet State
  const [wallet, setWallet] = useState<InAppWallet | undefined>(undefined);
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showGiftsCatalogModal, setShowGiftsCatalogModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Sync In-App Wallet and user from Neon PostgreSQL server on mount
  useEffect(() => {
    fetch(`/api/wallet/info?userId=${user.id}&username=${encodeURIComponent(user.username)}`)
      .then(res => res.json())
      .then(data => {
        if (data.wallet) {
          setWallet(data.wallet);
          setUser(prev => ({ ...prev, credits: data.wallet.credits }));
        }
        if (typeof data.isAdmin === 'boolean') {
          setIsAdmin(data.isAdmin);
        }
      })
      .catch(console.error);
  }, [user.id]);

  // Telegram BackButton Synchronization
  useEffect(() => {
    const isRoot =
      currentTab === 'games' &&
      selectedGame === null &&
      !showWalletModal &&
      !showGiftsCatalogModal &&
      !showAdminModal;

    setupTelegramBackButton(() => {
      if (showWalletModal) {
        setShowWalletModal(false);
      } else if (showGiftsCatalogModal) {
        setShowGiftsCatalogModal(false);
      } else if (showAdminModal) {
        setShowAdminModal(false);
      } else if (selectedGame !== null) {
        setSelectedGame(null);
      } else if (currentTab !== 'games') {
        setCurrentTab('games');
      }
    }, isRoot);
  }, [currentTab, selectedGame, showWalletModal, showGiftsCatalogModal, showAdminModal]);

  useEffect(() => {
    safeStorage.setItem('arena_user_profile', JSON.stringify(user));
    // Sync with Neon PostgreSQL
    fetch('/api/user/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        credits: user.credits,
        inventory: user.inventory
      })
    }).catch(() => {});
  }, [user]);

  // Round & Game State
  const [roundState, setRoundState] = useState<CurrentRoundState>({
    roundId: 436014,
    status: 'WAITING_FOR_PLAYERS',
    poolTier: 'STANDARD',
    serverSeedHash: 'e880fa31b9920194812398418abdf62901239129031203912039120391203912',
    totalPool: 0,
    totalTonPool: 0,
    totalStarsPool: 0,
    bets: [],
    timeRemainingMs: 20000,
    roundDurationMs: 20000,
    resolutionDurationMs: 10000,
    celebrationDurationMs: 6000,
    minPlayersNeeded: 1
  });

  const [history, setHistory] = useState<RoundHistoryItem[]>(() => {
    try {
      const saved = safeStorage.getItem('arena_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [selectedRelics, setSelectedRelics] = useState<Relic[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [autoStart, setAutoStart] = useState<boolean>(false);

  // Modals
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showProvablyFairModal, setShowProvablyFairModal] = useState(false);
  const [historicalInspectRound, setHistoricalInspectRound] = useState<RoundHistoryItem | null>(null);
  const [replayRound, setReplayRound] = useState<RoundHistoryItem | null>(null);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showRelicPicker, setShowRelicPicker] = useState(false);
  const [showPrivateRoomModal, setShowPrivateRoomModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Dev actions
  const handleAddRandomPlayer = (creditAmount?: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'DEV_ADD_PLAYER',
        creditAmount
      }));
    } else {
      fetch('/api/dev/add-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditAmount })
      });
    }
  };

  const handleStartRound = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEV_START_ROUND' }));
    } else {
      fetch('/api/dev/start-round', { method: 'POST' });
    }
  };

  const handleRollNow = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEV_ROLL_NOW' }));
    } else {
      fetch('/api/dev/roll-now', { method: 'POST' });
    }
  };

  const handleResetRound = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEV_RESET_ROUND' }));
    } else {
      fetch('/api/dev/reset-round', { method: 'POST' });
    }
  };

  const handleToggleAutoStart = (enabled: boolean) => {
    setAutoStart(enabled);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEV_SET_AUTO_START', autoStart: enabled }));
    } else {
      fetch('/api/dev/auto-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
    }
  };

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const prevStatusRef = useRef<string>(roundState.status);

  // Connect to WebSocket Server
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Request initial state
        ws.send(JSON.stringify({ type: 'GET_INIT' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'INIT_STATE') {
            setRoundState(data.state);
            if (data.history) {
              setHistory(data.history);
              safeStorage.setItem('arena_history', JSON.stringify(data.history));
            }
          } else if (data.type === 'ROUND_STATE') {
            setRoundState(data.state);
            if (data.history) {
              setHistory(data.history);
              safeStorage.setItem('arena_history', JSON.stringify(data.history));
            }

            // Handle transition to celebration
            if (data.state.status === 'WINNER_CELEBRATION' && prevStatusRef.current !== 'WINNER_CELEBRATION') {
              sound.playVictory();
              setTimeout(() => {
                setShowVictoryModal(true);
              }, 1200);

              // If current user is the winner, credit payout to balance and add won relics
              if (data.state.winner && data.state.winner.playerId === user.id) {
                const payoutTon = data.state.winner.payoutTon || 0;
                const payoutStars = data.state.winner.payoutStars || 0;
                const wonRelics = data.state.winner.wonRelics || [];

                setUser(prev => ({
                  ...prev,
                  tonBalance: +(prev.tonBalance + payoutTon).toFixed(4),
                  starsBalance: prev.starsBalance + payoutStars,
                  inventory: [...prev.inventory, ...wonRelics]
                }));
              }
            } else if (data.state.status === 'BETTING_OPEN' && prevStatusRef.current === 'WINNER_CELEBRATION') {
              setShowVictoryModal(false);
              setSelectedRelics([]);
            }

            prevStatusRef.current = data.state.status;
          } else if (data.type === 'CANCEL_BET_RESPONSE') {
            if (data.success) {
              sound.playVictory();
              haptic.notification('success');
              setUser(prev => ({
                ...prev,
                tonBalance: +(prev.tonBalance + (data.refundedTon || 0)).toFixed(4),
                starsBalance: prev.starsBalance + (data.refundedStars || 0)
              }));
            }
          } else if (data.type === 'TIME_TICK') {
            setRoundState(prev => ({
              ...prev,
              timeRemainingMs: data.timeRemainingMs,
              isBettingClosed: data.isBettingClosed !== undefined ? data.isBettingClosed : prev.isBettingClosed
            }));
          } else if (data.type === 'CHAT_MESSAGE') {
            setMessages(prev => [...prev.slice(-99), data.message]);
            if (!showChat) {
              setUnreadChatCount(count => count + 1);
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // Ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Faucet claim handler
  const handleClaimFaucet = () => {
    sound.playVictory();
    const newRelic: Relic = {
      id: 'rel_faucet_' + Date.now(),
      name: 'Arcane Shard',
      rarity: 'rare',
      value: 120,
      icon: '💎',
      color: '#38bdf8'
    };
    setUser(prev => ({
      ...prev,
      credits: +(prev.credits + 500).toFixed(2),
      inventory: [...prev.inventory, newRelic]
    }));
  };

  // Place Bet in Area PvP (supports TON or Telegram Stars)
  const handlePlaceBet = (currency: 'ton' | 'stars', amount: number, relics: Relic[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (currency === 'ton') {
      setUser(prev => ({
        ...prev,
        tonBalance: +(prev.tonBalance - amount).toFixed(4),
        inventory: prev.inventory.filter(item => !relics.some(r => r.id === item.id))
      }));
    } else {
      setUser(prev => ({
        ...prev,
        starsBalance: Math.max(0, prev.starsBalance - Math.floor(amount)),
        inventory: prev.inventory.filter(item => !relics.some(r => r.id === item.id))
      }));
    }

    setSelectedRelics([]);

    wsRef.current.send(JSON.stringify({
      type: 'PLACE_BET',
      playerId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: '#06b6d4',
      currency,
      amount,
      relics
    }));
  };

  // Cancel Bet & Refund in Area PvP (when alone in waiting phase)
  const handleCancelBet = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CANCEL_BET',
        playerId: user.id
      }));
    } else {
      try {
        const res = await fetch('/api/area/cancel-bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: user.id })
        });
        const data = await res.json();
        if (data.success) {
          sound.playVictory();
          haptic.notification('success');
          setUser(prev => ({
            ...prev,
            tonBalance: +(prev.tonBalance + (data.refundedTon || 0)).toFixed(4),
            starsBalance: prev.starsBalance + (data.refundedStars || 0)
          }));
        }
      } catch (e) {
        console.error('Error cancelling bet:', e);
      }
    }
  };

  const handleToggleRelic = (relic: Relic) => {
    setSelectedRelics(prev => {
      const exists = prev.some(r => r.id === relic.id);
      if (exists) {
        return prev.filter(r => r.id !== relic.id);
      } else {
        return [...prev, relic];
      }
    });
  };

  const handleRemoveRelic = (id: string) => {
    setSelectedRelics(prev => prev.filter(r => r.id !== id));
  };

  const handleSendMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      username: user.username,
      avatar: user.avatar,
      text
    }));
  };

  const getActiveTitle = () => {
    if (currentTab !== 'games') {
      if (currentTab === 'tasks') return 'Tasks';
      if (currentTab === 'shop') return 'Shop';
      if (currentTab === 'inventory') return 'Inventory';
      if (currentTab === 'profile') return 'Profile';
    }
    if (selectedGame === 'area_pvp') return 'Area PvP';
    if (selectedGame === 'mines_pve') return 'Mines';
    if (selectedGame === 'cases') return 'Cases';
    if (selectedGame === 'crush_pve') return 'Crush';
    if (selectedGame === 'bump_arena') return 'Bump Arena';
    return null;
  };

  const handleBackToMenu = () => {
    setSelectedGame(null);
    setCurrentTab('games');
  };

  return (
    <div className="min-h-screen bg-[#0b0c14] text-white flex flex-col font-sans selection:bg-[#ccff00] selection:text-black w-full max-w-full overflow-x-hidden">
      {/* Top Header Bar */}
      <Header
        user={user}
        wallet={wallet}
        activeGameTitle={getActiveTitle()}
        onBackToMenu={handleBackToMenu}
        onClaimFaucet={handleClaimFaucet}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onOpenWallet={() => setShowWalletModal(true)}
        onOpenAdmin={() => setShowAdminModal(true)}
        isAdmin={isAdmin}
        onToggleChat={selectedGame === 'area_pvp' ? () => {
          setShowChat(!showChat);
          if (!showChat) setUnreadChatCount(0);
        } : undefined}
        unreadChatCount={unreadChatCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto px-2 xs:px-3 py-2.5 flex flex-col gap-3 pb-24 overflow-x-hidden">
        {/* TAB 1: GAMES */}
        {currentTab === 'games' && (
          selectedGame === null ? (
            /* Main Menu with Game Posters */
            <GameHub
              onSelectGame={(id) => setSelectedGame(id)}
              activePot={roundState.totalPool || 15.5}
              onlinePlayers={roundState.bets.length + 142}
              enabledGames={enabledGames}
            />
          ) : selectedGame === 'area_pvp' ? (
            /* Area PvP Air Hockey Showdown */
            <>
              <PoolInfo
                roundState={roundState}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />

              {activeTab === 'current' ? (
                <>
                  <TerritoryCanvas roundState={roundState} />

                  <BettingControls
                    roundState={roundState}
                    user={user}
                    selectedRelics={selectedRelics}
                    onOpenRelicPicker={() => setShowRelicPicker(true)}
                    onRemoveRelic={handleRemoveRelic}
                    onPlaceBet={handlePlaceBet}
                    onCancelBet={handleCancelBet}
                    onStartRound={handleStartRound}
                  />

                  {isAdmin && (
                    <DevControls
                      roundState={roundState}
                      onAddRandomPlayer={handleAddRandomPlayer}
                      onStartRound={handleStartRound}
                      onRollNow={handleRollNow}
                      onResetRound={handleResetRound}
                      autoStart={autoStart}
                      onToggleAutoStart={handleToggleAutoStart}
                    />
                  )}

                  <PlayerRoster
                    bets={roundState.bets}
                    serverSeedHash={roundState.serverSeedHash}
                    poolTier={roundState.poolTier}
                    onCreatePrivateRoom={() => setShowPrivateRoomModal(true)}
                    onOpenProvablyFairModal={() => {
                      setHistoricalInspectRound(null);
                      setShowProvablyFairModal(true);
                    }}
                  />
                </>
              ) : (
                <HistoryTab
                  history={history}
                  onInspectRound={(round) => {
                    setHistoricalInspectRound(round);
                    setShowProvablyFairModal(true);
                  }}
                  onWatchReplay={(round) => {
                    setReplayRound(round);
                  }}
                />
              )}
            </>
          ) : selectedGame === 'mines_pve' ? (
            <MinesGame user={user} setUser={setUser} onBack={handleBackToMenu} />
          ) : selectedGame === 'cases' ? (
            <CasesGame user={user} setUser={setUser} onBack={handleBackToMenu} />
          ) : selectedGame === 'crush_pve' ? (
            <CrushGame user={user} setUser={setUser} onBack={handleBackToMenu} />
          ) : (
            <BumpArenaGame user={user} setUser={setUser} onBack={handleBackToMenu} />
          )
        )}

        {/* TAB 2: TASKS */}
        {currentTab === 'tasks' && (
          <TasksScreen user={user} setUser={setUser} />
        )}

        {/* TAB 3: SHOP */}
        {currentTab === 'shop' && (
          <ShopScreen
            user={user}
            setUser={setUser}
            wallet={wallet}
            onOpenWallet={() => setShowWalletModal(true)}
            onOpenGiftsCatalog={() => setShowGiftsCatalogModal(true)}
          />
        )}

        {/* TAB 4: INVENTORY */}
        {currentTab === 'inventory' && (
          <InventoryScreen
            user={user}
            setUser={setUser}
            onOpenShop={() => setCurrentTab('shop')}
            onOpenGiftsCatalog={() => setShowGiftsCatalogModal(true)}
          />
        )}

        {/* TAB 5: PROFILE */}
        {currentTab === 'profile' && (
          <ProfileScreen
            user={user}
            wallet={wallet}
            onOpenWallet={() => setShowWalletModal(true)}
            onOpenGiftsCatalog={() => setShowGiftsCatalogModal(true)}
            onOpenAdmin={() => setShowAdminModal(true)}
            isAdmin={isAdmin}
          />
        )}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedGame(null);
        }}
        inventoryCount={user.inventory.length}
        availableTasksCount={2}
      />

      {/* Modals & Overlays */}
      {/* In-App Internal Wallet Modal */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        user={user}
        onWalletUpdated={(updated) => {
          setWallet(updated);
          setUser(prev => ({ ...prev, credits: updated.credits }));
        }}
        onOpenGiftsCatalog={() => {
          setShowWalletModal(false);
          setShowGiftsCatalogModal(true);
        }}
        onOpenAdmin={() => {
          setShowWalletModal(false);
          setShowAdminModal(true);
        }}
        isAdmin={isAdmin}
      />

      {/* Telegram Gifts Catalog Modal */}
      <GiftsCatalogModal
        isOpen={showGiftsCatalogModal}
        onClose={() => setShowGiftsCatalogModal(false)}
        user={user}
        onGiftPurchased={() => {
          fetch(`/api/wallet/info?userId=${user.id}&username=${encodeURIComponent(user.username)}`)
            .then(res => res.json())
            .then(data => {
              if (data.wallet) {
                setWallet(data.wallet);
                setUser(prev => ({ ...prev, credits: data.wallet.credits }));
              }
            });
        }}
      />

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        userId={user.id}
      />

      {replayRound && (
        <RoundReplayModal
          round={replayRound}
          onClose={() => setReplayRound(null)}
          onOpenVerify={(round) => {
            setHistoricalInspectRound(round);
            setShowProvablyFairModal(true);
          }}
        />
      )}
      {showVictoryModal && (
        <VictoryModal
          roundState={roundState}
          onClose={() => setShowVictoryModal(false)}
          onOpenVerify={() => {
            setShowVictoryModal(false);
            setHistoricalInspectRound(null);
            setShowProvablyFairModal(true);
          }}
        />
      )}

      {showProvablyFairModal && (
        <ProvablyFairModal
          roundState={roundState}
          historicalRound={historicalInspectRound}
          onClose={() => {
            setShowProvablyFairModal(false);
            setHistoricalInspectRound(null);
          }}
        />
      )}

      {showHowItWorksModal && (
        <HowItWorksModal onClose={() => setShowHowItWorksModal(false)} />
      )}

      {showRelicPicker && (
        <RelicInventoryModal
          inventory={user.inventory}
          selectedRelics={selectedRelics}
          onToggleSelect={handleToggleRelic}
          onClose={() => setShowRelicPicker(false)}
        />
      )}

      {showPrivateRoomModal && (
        <PrivateRoomModal onClose={() => setShowPrivateRoomModal(false)} />
      )}

      {/* Live Chat Drawer */}
      <LiveChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={messages}
        user={user}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
