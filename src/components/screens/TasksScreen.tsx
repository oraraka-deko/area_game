import React, { useState } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { CheckCircle2, Gift, Users, Trophy, ExternalLink, Sparkles } from 'lucide-react';

interface TasksScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  isCompleted: boolean;
  isClaimed: boolean;
  link?: string;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({ user, setUser }) => {
  const [dailyClaimed, setDailyClaimed] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 'tg_channel',
      title: 'Join Official Telegram Channel',
      description: 'Get match updates, promo codes and tournament alerts',
      reward: 150,
      icon: '📢',
      isCompleted: false,
      isClaimed: false,
      link: 'https://t.me/telegram'
    },
    {
      id: 'invite_friend',
      title: 'Invite Telegram Friends',
      description: 'Share your referral link with 1 friend',
      reward: 300,
      icon: '👥',
      isCompleted: false,
      isClaimed: false
    },
    {
      id: 'play_3_arena',
      title: 'Arena Gladiator',
      description: 'Participate in 3 Area PvP showdowns',
      reward: 200,
      icon: '⚔️',
      isCompleted: true,
      isClaimed: false
    },
    {
      id: 'open_case',
      title: 'Loot Collector',
      description: 'Unbox any Mystery Crate in Cases',
      reward: 100,
      icon: '🎁',
      isCompleted: false,
      isClaimed: false
    }
  ]);

  const handleClaimDaily = () => {
    if (dailyClaimed) return;
    const reward = 50;
    setUser(prev => ({ ...prev, credits: +(prev.credits + reward).toFixed(2) }));
    setDailyClaimed(true);
    sound.playVictory();
    haptic.notification('success');
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          if (!t.isCompleted) {
            haptic.impact('medium');
            if (t.link) window.open(t.link, '_blank');
            return { ...t, isCompleted: true };
          } else if (!t.isClaimed) {
            setUser(u => ({ ...u, credits: +(u.credits + t.reward).toFixed(2) }));
            sound.playVictory();
            haptic.notification('success');
            return { ...t, isClaimed: true };
          }
        }
        return t;
      })
    );
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* Daily Check-in Card */}
      <div className="rounded-3xl border border-[#ccff00]/30 bg-gradient-to-br from-[#1a2215] to-[#0d121c] p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="text-sm font-black text-white uppercase tracking-wider">
                Daily Check-in
              </div>
              <div className="text-[11px] text-white/50">
                Log in every day to collect free credits!
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-black font-mono text-[#ccff00]">+50 🪙</div>
          </div>
        </div>

        <button
          disabled={dailyClaimed}
          onClick={handleClaimDaily}
          className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-md ${
            dailyClaimed
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : 'bg-[#ccff00] hover:bg-[#b8e600] text-black shadow-[#ccff00]/20'
          }`}
        >
          {dailyClaimed ? 'Claimed for Today ✅' : 'Claim Daily +50 Credits'}
        </button>
      </div>

      {/* Quests List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70">
            Available Quests
          </span>
          <span className="text-[11px] font-mono text-emerald-400">
            Earn up to 750 🪙
          </span>
        </div>

        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-[#121422] transition hover:border-white/10"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{task.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {task.title}
                  </div>
                  <div className="text-[10px] text-white/50 line-clamp-1 mt-0.5">
                    {task.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-black text-[#ccff00]">
                  +{task.reward} 🪙
                </span>

                <button
                  disabled={task.isClaimed}
                  onClick={() => handleCompleteTask(task.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                    task.isClaimed
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : task.isCompleted
                      ? 'bg-[#ccff00] text-black font-black hover:bg-[#b8e600]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {task.isClaimed ? 'Claimed' : task.isCompleted ? 'Claim' : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
