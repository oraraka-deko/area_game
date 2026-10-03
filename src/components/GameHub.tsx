import React from 'react';
import { Play, Users, Sparkles, Flame, ShieldAlert, Award, ArrowRight, Lock } from 'lucide-react';
import { haptic } from '../utils/telegram.js';

export type GameId = 'area_pvp' | 'mines_pve' | 'cases' | 'crush_pve' | 'bump_arena';

interface GameHubProps {
  onSelectGame: (gameId: GameId) => void;
  activePot?: number;
  onlinePlayers?: number;
  enabledGames?: {
    arena: boolean;
    mines: boolean;
    crush: boolean;
    cases: boolean;
    bumper: boolean;
  };
}

export const GameHub: React.FC<GameHubProps> = ({
  onSelectGame,
  activePot = 15.5,
  onlinePlayers = 168,
  enabledGames = {
    arena: true,
    mines: true,
    crush: true,
    cases: true,
    bumper: true
  }
}) => {
  const games: {
    id: GameId;
    gameKey: keyof typeof enabledGames;
    title: string;
    subtitle: string;
    tag: string;
    tagColor: string;
    isHot?: boolean;
    isPvP?: boolean;
    online: number;
    statLabel: string;
    statValue: string;
    image: string;
    accentColor: string;
    borderGlow: string;
  }[] = [
    {
      id: 'area_pvp',
      gameKey: 'arena',
      title: 'Area PvP',
      subtitle: 'Air Hockey Territory Slicing Arena',
      tag: '🔥 POPULAR • LIVE PVP',
      tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      isHot: true,
      isPvP: true,
      online: onlinePlayers,
      statLabel: 'GAME TYPE',
      statValue: '2D LIVE PVP',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
      accentColor: '#06b6d4',
      borderGlow: 'hover:border-cyan-500/60 hover:shadow-[0_0_28px_rgba(6,182,212,0.25)]'
    },
    {
      id: 'mines_pve',
      gameKey: 'mines',
      title: 'Mines PvE',
      subtitle: 'Uncover Diamonds in TON or Stars',
      tag: '💎 UP TO 100x',
      tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      online: 94,
      statLabel: 'MAX MULTIPLIER',
      statValue: '100x',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      accentColor: '#06b6d4',
      borderGlow: 'hover:border-cyan-500/60 hover:shadow-[0_0_28px_rgba(6,182,212,0.25)]'
    },
    {
      id: 'cases',
      gameKey: 'cases',
      title: 'Cases',
      subtitle: 'Unbox Cyber Crates & Rare Relics',
      tag: '🎁 LOOT CRATES',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      online: 76,
      statLabel: 'LEGENDARY CHANCE',
      statValue: '12.5%',
      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
      accentColor: '#a855f7',
      borderGlow: 'hover:border-purple-500/60 hover:shadow-[0_0_28px_rgba(168,85,247,0.25)]'
    },
    {
      id: 'crush_pve',
      gameKey: 'crush',
      title: 'Crush PvE',
      subtitle: 'Rocket Curve Multiplier • Cash Out in Time',
      tag: '🚀 CRASH MULTIPLIER',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      online: 112,
      statLabel: 'TOP CRUSH',
      statValue: '284.6x',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
      accentColor: '#10b981',
      borderGlow: 'hover:border-emerald-500/60 hover:shadow-[0_0_28px_rgba(16,185,129,0.25)]'
    },
    {
      id: 'bump_arena',
      gameKey: 'bumper',
      title: 'Bump Area PvP',
      subtitle: 'Sumo Puck Ring Out • Knockout Showdown',
      tag: '🥊 SUMO BUMPER PVP',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      online: 62,
      statLabel: 'GAME TYPE',
      statValue: 'SUMO PVP BUMPER',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
      accentColor: '#f59e0b',
      borderGlow: 'hover:border-amber-500/60 hover:shadow-[0_0_28px_rgba(245,158,11,0.25)]'
    }
  ];

  const handleLaunchGame = (id: GameId, isEnabled: boolean) => {
    if (!isEnabled) {
      haptic.notification('warning');
      return;
    }
    haptic.impact('medium');
    onSelectGame(id);
  };

  const isAreaEnabled = enabledGames.arena !== false;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-4 px-3">
      {/* Featured Hero Banner: Area PvP */}
      <div className="relative rounded-3xl overflow-hidden border border-cyan-500/40 bg-gradient-to-b from-[#141a29] to-[#0d1017] shadow-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>Featured PvP Arena</span>
          </span>

          <div className="flex items-center gap-1.5 text-xs text-white/70 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{onlinePlayers} Live Online</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Area PvP</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-mono font-normal">
              Provably Fair
            </span>
          </h1>
          <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
            Multiplayer 2D territory slicing arena with TON & Stars betting, 5% bot rake, and 1-minute refund protection.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300/90 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Multiplayer Slicing Battles</span>
          </div>

          <button
            onClick={() => handleLaunchGame('area_pvp', isAreaEnabled)}
            disabled={!isAreaEnabled}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center gap-1.5 shadow-lg ${
              isAreaEnabled
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-black shadow-cyan-400/25'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {isAreaEnabled ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Area</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Maintenance</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Arcade Games Grid */}
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
          Arcade & PvP Modes
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {games.map(g => {
            const isEnabled = enabledGames[g.gameKey] !== false;

            return (
              <div
                key={g.id}
                onClick={() => handleLaunchGame(g.id, isEnabled)}
                className={`group relative rounded-3xl bg-[#121524] border border-white/10 p-4 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg ${
                  isEnabled ? `${g.borderGlow} cursor-pointer active:scale-98` : 'opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Background Artwork Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition duration-500"
                  style={{ backgroundImage: `url(${g.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121524] via-[#121524]/85 to-transparent" />

                <div className="relative z-10 flex items-start justify-between">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-sm ${g.tagColor}`}>
                    {g.tag}
                  </span>

                  {!isEnabled ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Disabled</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] text-white/50 font-mono">
                      <Users className="w-3 h-3" />
                      <span>{g.online}</span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 my-3">
                  <h3 className="text-lg font-black text-white group-hover:text-cyan-300 transition">
                    {g.title}
                  </h3>
                  <p className="text-[11px] text-white/60 line-clamp-1 mt-0.5 font-medium">
                    {g.subtitle}
                  </p>
                </div>

                <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/5">
                  <div>
                    <div className="text-[9px] text-white/40 font-mono uppercase tracking-wider">
                      {g.statLabel}
                    </div>
                    <div className="text-xs font-black font-mono text-cyan-300">
                      {g.statValue}
                    </div>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition shadow-md ${
                      isEnabled
                        ? 'bg-white/10 group-hover:bg-white text-white group-hover:text-black'
                        : 'bg-white/5 text-white/30'
                    }`}
                  >
                    {isEnabled ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
