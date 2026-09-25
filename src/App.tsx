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
import { sound } from './utils/audio.js';

// Default starting user profile
const INITIAL_USER: UserProfile = {
  id: 'usr_' + Math.random().toString(36).substring(2, 9),
  username: 'NeoGlitch',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  credits: 2500,
  inventory: [
    { id: 'rel_init_1', name: 'Bronze Talisman', rarity: 'common', value: 25, icon: '🥉', color: '#cd7f32' },
    { id: 'rel_init_2', name: 'Silver Chalice', rarity: 'rare', value: 150, icon: '🏆', color: '#cbd5e1' },
    { id: 'rel_init_3', name: 'Neon Prism', rarity: 'epic', value: 750, icon: '🔮', color: '#c084fc' }
  ]
};

export default function App() {
  // User state
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('arena_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  useEffect(() => {
    localStorage.setItem('arena_user_profile', JSON.stringify(user));
  }, [user]);

  // Round & Game State
  const [roundState, setRoundState] = useState<CurrentRoundState>({
    roundId: 436014,
    status: 'WAITING_FOR_PLAYERS',
    poolTier: 'STANDARD',
    serverSeedHash: 'e880fa31b9920194812398418abdf62901239129031203912039120391203912',
    totalPool: 0,
    bets: [],
    timeRemainingMs: 20000,
    roundDurationMs: 20000,
    resolutionDurationMs: 8500,
    celebrationDurationMs: 6000,
    minPlayersNeeded: 1
  });

  const [history, setHistory] = useState<RoundHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('arena_history');
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
        console.log('Connected to Territory Arena WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'INIT_STATE') {
            setRoundState(data.state);
            if (data.history) {
              setHistory(data.history);
              try { localStorage.setItem('arena_history', JSON.stringify(data.history)); } catch (e) {}
            }
          } else if (data.type === 'ROUND_STATE') {
            setRoundState(data.state);
            if (data.history) {
              setHistory(data.history);
              try { localStorage.setItem('arena_history', JSON.stringify(data.history)); } catch (e) {}
            }

            // Handle transition to celebration
            if (data.state.status === 'WINNER_CELEBRATION' && prevStatusRef.current !== 'WINNER_CELEBRATION') {
              sound.playVictory();
              setTimeout(() => {
                setShowVictoryModal(true);
              }, 400);

              // If current user is the winner, credit payout to balance and add won relics
              if (data.state.winner && data.state.winner.playerId === user.id) {
                const payout = data.state.winner.payout;
                const wonRelics = data.state.winner.wonRelics || [];
                setUser(prev => ({
                  ...prev,
                  credits: +(prev.credits + payout).toFixed(2),
                  inventory: [...prev.inventory, ...wonRelics]
                }));
              }
            } else if (data.state.status === 'BETTING_OPEN' && prevStatusRef.current === 'WINNER_CELEBRATION') {
              setShowVictoryModal(false);
              setSelectedRelics([]);
            }

            prevStatusRef.current = data.state.status;
          } else if (data.type === 'TIME_TICK') {
            setRoundState(prev => ({
              ...prev,
              timeRemainingMs: data.timeRemainingMs,
              isBettingClosed: data.isBettingClosed !== undefined ? data.isBettingClosed : prev.isBettingClosed
            }));
          } else if (data.type === 'CHAT_MESSAGE') {
            setMessages(prev => [...prev.slice(-40), data.message]);
            if (!showChat) {
              setUnreadChatCount(prev => prev + 1);
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WS closed, reconnecting in 2s...');
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [user.id, showChat]);

  // Faucet claim handler
  const handleClaimFaucet = () => {
    sound.playVictory();
    const newRelic: Relic = {
      id: 'rel_faucet_' + Date.now(),
      name: 'Cobalt Core',
      rarity: 'rare',
      value: 300,
      icon: '💎',
      color: '#38bdf8'
    };

    setUser(prev => ({
      ...prev,
      credits: +(prev.credits + 500).toFixed(2),
      inventory: [...prev.inventory, newRelic]
    }));
  };

  // Place Bet
  const handlePlaceBet = (creditAmount: number, relics: Relic[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Deduct credits & relics locally immediately
    setUser(prev => ({
      ...prev,
      credits: +(prev.credits - creditAmount).toFixed(2),
      inventory: prev.inventory.filter(item => !relics.some(r => r.id === item.id))
    }));

    // Clear selected relics
    setSelectedRelics([]);

    // Send to WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'PLACE_BET',
      playerId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: '#ccff00',
      creditAmount,
      relics
    }));
  };

  // Toggle Relic Selection
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

  // Chat message sending
  const handleSendMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      username: user.username,
      avatar: user.avatar,
      text
    }));
  };

  return (
    <div className="min-h-screen bg-[#0c0d14] text-white flex flex-col font-sans selection:bg-[#ccff00] selection:text-black">
      {/* Top Header Bar */}
      <Header
        user={user}
        onClaimFaucet={handleClaimFaucet}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onToggleChat={() => {
          setShowChat(!showChat);
          if (!showChat) setUnreadChatCount(0);
        }}
        unreadChatCount={unreadChatCount}
      />

      {/* Main Content Arena */}
      <main className="flex-1 w-full max-w-md sm:max-w-lg mx-auto px-3 py-2.5 flex flex-col gap-3">
        {/* Pool Header & Tabs */}
        <PoolInfo
          roundState={roundState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {activeTab === 'current' ? (
          <>
            {/* Center Dynamic 2D Territory Canvas */}
            <TerritoryCanvas roundState={roundState} />

            {/* Betting Controls */}
            <BettingControls
              roundState={roundState}
              user={user}
              selectedRelics={selectedRelics}
              onOpenRelicPicker={() => setShowRelicPicker(true)}
              onRemoveRelic={handleRemoveRelic}
              onPlaceBet={handlePlaceBet}
              onStartRound={handleStartRound}
            />

            {/* Development Toolbar: Add Random Players & Round Controls */}
            <DevControls
              roundState={roundState}
              onAddRandomPlayer={handleAddRandomPlayer}
              onStartRound={handleStartRound}
              onRollNow={handleRollNow}
              onResetRound={handleResetRound}
              autoStart={autoStart}
              onToggleAutoStart={handleToggleAutoStart}
            />

            {/* Expandable Player Roster */}
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
          /* Past Rounds History Tab */
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
      </main>

      {/* Modals & Overlays */}
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
