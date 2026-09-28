// Telegram Mini App (TWA) Integration Helper

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: TelegramUser;
          query_id?: string;
          auth_date?: string;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
      };
    };
  }
}

/**
 * Returns Telegram WebApp if running inside Telegram Mini App
 */
export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Initialize Telegram Mini App settings: expand, ready, and closing confirmation
 */
export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }
    } catch (e) {
      console.warn('Telegram WebApp init error:', e);
    }
  }
}

/**
 * Get user information from Telegram initDataUnsafe or fallback
 */
export function getTelegramUser(): { id: string; username: string; avatar: string } {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;

  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const displayUsername = user.username ? `@${user.username}` : fullName || `User_${user.id}`;
    const avatar = user.photo_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80`;

    return {
      id: String(user.id),
      username: displayUsername,
      avatar
    };
  }

  // Fallback for desktop / standard browser testing
  return {
    id: 'usr_om3sgry',
    username: 'NeoGlitch',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
  };
}

/**
 * Haptic feedback helper with native Telegram WebApp support and navigator.vibrate fallback
 */
export const haptic = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred(style);
        return;
      } catch (e) {}
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const duration = style === 'heavy' ? 40 : style === 'medium' ? 25 : 12;
      navigator.vibrate(duration);
    }
  },

  notification: (type: 'error' | 'success' | 'warning' = 'success') => {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.notificationOccurred(type);
        return;
      } catch (e) {}
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') navigator.vibrate([15, 40, 25]);
      else if (type === 'warning') navigator.vibrate([30, 30, 30]);
      else navigator.vibrate([50, 40, 50]);
    }
  },

  selection: () => {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.selectionChanged();
        return;
      } catch (e) {}
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }
};

/**
 * Telegram TopBar Back Button management
 * When isRoot is false: shows BackButton and runs onBack on click.
 * When isRoot is true: BackButton acts as close app or is hidden.
 */
let currentBackCallback: (() => void) | null = null;

export function setupTelegramBackButton(onBack: () => void, isRoot: boolean) {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  try {
    if (currentBackCallback) {
      tg.BackButton.offClick(currentBackCallback);
      currentBackCallback = null;
    }

    if (isRoot) {
      // In main menu: hide BackButton (or clicking close app)
      tg.BackButton.hide();
      currentBackCallback = () => {
        tg.close();
      };
      tg.BackButton.onClick(currentBackCallback);
    } else {
      // In a game or subpage: show BackButton and navigate back
      tg.BackButton.show();
      currentBackCallback = onBack;
      tg.BackButton.onClick(currentBackCallback);
    }
  } catch (e) {
    console.warn('Error configuring Telegram BackButton:', e);
  }
}
