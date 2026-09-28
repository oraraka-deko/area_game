import React from 'react';
import { Gamepad2, CheckSquare, ShoppingBag, Backpack, User } from 'lucide-react';
import { haptic } from '../utils/telegram.js';

export type NavTab = 'games' | 'tasks' | 'shop' | 'inventory' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  inventoryCount?: number;
  availableTasksCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  inventoryCount = 0,
  availableTasksCount = 0
}) => {
  const tabs = [
    {
      id: 'games' as NavTab,
      label: 'Games',
      icon: Gamepad2,
      badge: null
    },
    {
      id: 'tasks' as NavTab,
      label: 'Tasks',
      icon: CheckSquare,
      badge: availableTasksCount > 0 ? String(availableTasksCount) : null
    },
    {
      id: 'shop' as NavTab,
      label: 'Shop',
      icon: ShoppingBag,
      badge: 'TON'
    },
    {
      id: 'inventory' as NavTab,
      label: 'Inventory',
      icon: Backpack,
      badge: inventoryCount > 0 ? String(inventoryCount) : null
    },
    {
      id: 'profile' as NavTab,
      label: 'Profile',
      icon: User,
      badge: null
    }
  ];

  const handleTabClick = (tabId: NavTab) => {
    haptic.selection();
    onSelectTab(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f1a]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 safe-area-pb">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'text-[#ccff00]'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {/* Active Indicator Glow */}
              {isActive && (
                <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-[#ccff00] shadow-[0_0_12px_#ccff00]" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />

                {/* Badge */}
                {tab.badge && (
                  <span
                    className={`absolute -top-1.5 -right-3 text-[9px] font-black px-1.5 py-0.2 rounded-full leading-none flex items-center justify-center ${
                      tab.badge === 'TON'
                        ? 'bg-cyan-500 text-black'
                        : 'bg-[#ccff00] text-black shadow-sm'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] mt-1 font-bold tracking-tight ${isActive ? 'text-[#ccff00] font-black' : 'text-white/50'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
