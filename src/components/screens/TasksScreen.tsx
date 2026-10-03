import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { CheckCircle2, Gift, Users, Trophy, ExternalLink, Sparkles, Loader2 } from 'lucide-react';

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
  const [claimingId, setClaimingId] = useState<string | null>(null);
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
      description: 'Participate in Area PvP showdowns',
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
      isCompleted: true,
      isClaimed: false
    }
  ]);

  // Fetch claimed tasks from Neon PostgreSQL
  useEffect(() => {
    fetch(`/api/tasks/claimed?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.claimed)) {
          if (data.claimed.includes('daily_checkin')) {
            setDailyClaimed(true);
          }
          setTasks(prev =>
            prev.map(t =>
              data.claimed.includes(t.id) ? { ...t, isCompleted: true, isClaimed: true } : t
            )
          );
        }
      })
      .catch(console.error);
  }, [user.id]);

  const handleClaimDaily = async () => {
    if (dailyClaimed || claimingId) return;
    const reward = 50;
    setClaimingId('daily');

    try {
      const res = await fetch('/api/tasks/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          taskId: 'daily_checkin',
          rewardCredits: reward
        })
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => ({ ...prev, credits: +(prev.credits + reward).toFixed(2) }));
        setDailyClaimed(true);
        sound.playVictory();
        haptic.notification('success');
      }
    } catch (e) {
      console.error('Failed to claim daily reward:', e);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.isCompleted) {
      haptic.impact('medium');
      if (task.link) {
        try {
          window.open(task.link, '_blank');
        } catch (e) {}
      }
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, isCompleted: true } : t)));
      return;
    }

    if (task.isClaimed || claimingId) return;

    setClaimingId(taskId);
    try {
      const res = await fetch('/api/tasks/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          taskId,
          rewardCredits: task.reward
        })
      });
      const data = await res.json();
      if (data.success) {
        setUser(u => ({ ...u, credits: +(u.credits + task.reward).toFixed(2) }));
        sound.playVictory();
        haptic.notification('success');
        setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, isClaimed: true } : t)));
      }
    } catch (e) {
      console.error(`Failed to claim task ${taskId}:`, e);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* Daily Check-in Card */}
      <div className="rounded-3xl border border-[#ccff00]/30 bg-gradient-to-br from-[#1a2215] to-[#0d121c] p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Daily Rations</h2>
              <p className="text-[11px] text-white/50">Return daily to keep your combat stack fueled</p>
            </div>
          </div>
          <span className="text-xs font-black text-[#ccff00] bg-[#ccff00]/10 px-2.5 py-1 rounded-full border border-[#ccff00]/20">
            +50 Credits
          </span>
        </div>

        <button
          onClick={handleClaimDaily}
          disabled={dailyClaimed || claimingId === 'daily'}
          className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            dailyClaimed
              ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
              : 'bg-[#ccff00] text-black shadow-lg shadow-[#ccff00]/20 hover:brightness-110 active:scale-95 cursor-pointer'
          }`}
        >
          {claimingId === 'daily' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : dailyClaimed ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#ccff00]" /> Claimed (Reset in 24h)
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Claim 50 Daily Credits
            </>
          )}
        </button>
      </div>

      {/* Task List */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">Bounties & Challenges</span>
          <span className="text-[11px] text-white/40">Neon DB Synced</span>
        </div>

        {tasks.map(task => (
          <div
            key={task.id}
            className="rounded-2xl border border-white/10 bg-[#121624] p-3.5 flex items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                {task.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{task.title}</div>
                <div className="text-[10px] text-white/50 line-clamp-1">{task.description}</div>
                <div className="text-[10px] font-black text-[#ccff00] mt-0.5">+{task.reward} Credits</div>
              </div>
            </div>

            <button
              onClick={() => handleCompleteTask(task.id)}
              disabled={task.isClaimed || claimingId === task.id}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${
                task.isClaimed
                  ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                  : task.isCompleted
                  ? 'bg-[#ccff00] text-black shadow-md shadow-[#ccff00]/20 hover:brightness-110 active:scale-95 cursor-pointer'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 active:scale-95 cursor-pointer'
              }`}
            >
              {claimingId === task.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : task.isClaimed ? (
                'Claimed'
              ) : task.isCompleted ? (
                'Claim'
              ) : (
                'Start'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
