export interface InAppWallet {
  userId: string;
  username: string;
  tonBalance: number;
  starsBalance: number;
  credits: number;
  connectedWallet?: string;
  updatedAt: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'DEPOSIT_TON' | 'DEPOSIT_STARS' | 'WITHDRAW_TON' | 'GAME_CREDIT_TOPUP' | 'GIFT_BUY' | 'GIFT_DEPOSIT';
  amountTon?: number;
  amountStars?: number;
  amountCredits?: number;
  status: 'PENDING_WALLET' | 'PENDING_ON_CHAIN' | 'CONFIRMED' | 'REJECTED' | 'FAILED';
  comment?: string;
  txHash?: string;
  boc?: string;
  createdAt: number;
  confirmedAt?: number;
  details?: Record<string, any>;
}

export interface TelegramGiftTrait {
  name: string;
  rarity?: number;
  center_color?: string;
  edge_color?: string;
  pattern_color?: string;
  document_id?: string | null;
}

export interface TelegramGiftItem {
  gift_id: string;
  name: string;
  price_stars: number;
  total_stock: number;
  is_upgradeable: boolean;
  model_count: number;
  backdrop_count: number;
  symbol_count: number;
  sample_models: TelegramGiftTrait[];
  sample_backdrops: TelegramGiftTrait[];
  sample_symbols: TelegramGiftTrait[];
  bg_center?: string;
  bg_edge?: string;
  top_model?: string;
  floor_price_ton?: number;
  floor_price_usd?: number;
}

export interface UserInventoryGift {
  instanceId: string;
  giftId: string;
  name: string;
  priceStars: number;
  acquiredAt: number;
  modelName?: string;
  backdropColor?: string;
  edgeColor?: string;
  symbolName?: string;
  rarity?: number;
}

export interface AdminConfigData {
  depositWalletAddress: string;
  hasHotWallet: boolean;
  hotWalletMnemonic: string;
  toncenterApiKey: string;
  toncenterApiKeyTestnet: string;
  botStarsToken: string;
  isTestnet: boolean;
  adminTelegramIds: string[];
  neonConfigured: boolean;
}
