import React from 'react';
import { Play, Users, Sparkles, Flame, ShieldAlert, Award, ArrowRight } from 'lucide-react';
import { haptic } from '../utils/telegram.js';

export type GameId = 'area_pvp' | 'mines_pve' | 'cases' | 'crush_pve' | 'bump_arena';

interface GameHubProps {
  onSelectGame: (gameId: GameId) => void;
  activePot?: number;
  onlinePlayers?: number;
}

export const GameHub: React.FC<GameHubProps> = ({
  onSelectGame,
  activePot = 1250,
  onlinePlayers = 168
}) => {
  const games: {
    id: GameId;
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
      title: 'Area PvP',
      subtitle: 'Air Hockey Territory Slicing Arena',
      tag: '🔥 POPULAR • LIVE PVP',
      tagColor: 'bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/40',
      isHot: true,
      isPvP: true,
      online: onlinePlayers,
      statLabel: 'LIVE POT',
      statValue: `${activePot.toFixed(0)} 🪙`,
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
      accentColor: '#ccff00',
      borderGlow: 'hover:border-[#ccff00]/60 hover:shadow-[0_0_28px_rgba(204,255,0,0.25)]'
    },
    {
      id: 'mines_pve',
      title: 'Mines PvE',
      subtitle: 'Uncover Diamonds & Multiply Winnings',
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
      title: 'Bump Area PvP',
      subtitle: 'Sumo Puck Ring Out • Knockout Showdown',
      tag: '🥊 SUMO BUMPER PVP',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      online: 62,
      statLabel: 'WINNER TAKES ALL',
      statValue: '100% POT',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
      accentColor: '#f59e0b',
      borderGlow: 'hover:border-amber-500/60 hover:shadow-[0_0_28px_rgba(245,158,11,0.25)]'
    }
  ];

  const handleLaunchGame = (id: GameId) => {
    haptic.impact('medium');
    onSelectGame(id);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-4 px-3">
      {/* Featured Hero Banner: Area PvP */}
      <div className="relative rounded-3xl overflow-hidden border border-[#ccff00]/40 bg-gradient-to-b from-[#182014] to-[#0d1017] shadow-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#ccff00] text-black shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>Featured Arena</span>
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
              100% Fair
            </span>
          </h1>
          <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
            Dynamic 2D territory slicing air hockey showdown with real-time rigid body physics and VAR goal-line review!
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
              Current Jackpot
            </div>
            <div className="text-xl font-black font-mono text-[#ccff00]">
              {activePot.toFixed(2)} 🪙
            </div>
          </div>

          <button
            onClick={() => handleLaunchGame('area_pvp')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#ccff00] hover:bg-[#b8e600] text-black font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-md shadow-[#ccff00]/20"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            <span>Enter Match</span>
          </button>
        </div>
      </div>

      {/* Grid of Other Game Posters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Explore All Games (5)</span>
          </span>
          <span className="text-[10px] text-white/40 font-mono">Tap to Play</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {games.map(game => (
            <div
              key={game.id}
              onClick={() => handleLaunchGame(game.id)}
              className={`group relative rounded-2xl overflow-hidden border border-white/10 bg-[#141624] transition-all duration-200 cursor-pointer active:scale-[0.98] ${game.borderGlow} flex flex-col justify-between`}
            >
              {/* Poster Image Backdrop with Overlay */}
              <div className="relative h-28 w-full overflow-hidden">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141624] via-[#141624]/60 to-transparent" />

                {/* Tag Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border backdrop-blur-md ${game.tagColor}`}>
                    {game.tag}
                  </span>
                </div>

                {/* Online Counter */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/80">
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>{game.online}</span>
                </div>
              </div>

              {/* Game Info Bottom */}
              <div className="p-3.5 pt-1 flex flex-col gap-2">
                <div>
                  <div className="text-base font-extrabold text-white group-hover:text-[#ccff00] transition-colors flex items-center justify-between">
                    <span>{game.title}</span>
                    <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-[#ccff00] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
                    {game.subtitle}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] font-mono">
                  <span className="text-white/40">{game.statLabel}</span>
                  <span className="font-bold text-white" style={{ color: game.accentColor }}>
                    {game.statValue}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
