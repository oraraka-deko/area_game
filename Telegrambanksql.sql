-- =====================================================================
-- TELEGRAM MINI-APP "BANK" SCHEMA (SQLite dialect)
-- Refactored from original draft.
-- Run with: PRAGMA foreign_keys = ON;
-- =====================================================================
--
-- DESIGN NOTES (read once, then ignore the comments if you like):
--
-- 1. MONEY IS ALWAYS INTEGER, in the currency's smallest unit
--    (nanotons for TON, whole stars for XTR). Never store money as REAL.
--
-- 2. THERE IS EXACTLY ONE BALANCE SYSTEM: ledgerAccounts + ledgerEntries.
--    A "wallet" (user's in-app balance), the hot wallet, the fee pool,
--    and the Telegram Stars pool are all just rows in ledgerAccounts
--    with a different ownerType. Every balance change is a
--    ledgerTransaction with 2+ ledgerEntries whose amounts sum to zero
--    per currency. This is the standard double-entry pattern and it is
--    what will save you from "where did the money go" bugs.
--
-- 3. SESSIONS vs WALLET ATTACHMENTS: a userSession is one Telegram
--    client instance (phone app, desktop app, web app, or the same app
--    reinstalled = new session). A session can have at most one ACTIVE
--    externalWalletAddress attached at a time (enforced by a partial
--    unique index below). Disconnecting only changes that one
--    attachment row; other sessions' attachments are untouched. A new
--    session always starts with zero attachments, so the user must
--    attach a wallet again — exactly what you described.
--
-- 4. THREE INCOME PATHS map to three separate "intake" tables that all
--    eventually post one ledgerTransaction crediting the user's
--    ledgerAccount:
--       - deposits            (on-chain TON, verified via TonCenter)
--       - starsInvoices       (Telegram Stars payment, goes to the
--                              bot's Stars balance, locked ~21 days,
--                              withdrawn via Fragment)
--       - giftDeposits -> collectibleOperations (gift sent to a relay
--                              account, verified, optionally instantly
--                              sold to you at floor price)
--
-- 5. STATUS COLUMNS use CHECK constraints only where the value set is
--    small and stable. Where you'll likely add more statuses later
--    (order/game/service flows), I left them as free TEXT so you don't
--    have to migrate the schema every time you add a status — just be
--    consistent in application code.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- DROP (dependency-safe order: children before parents)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS adminAuditLog;
DROP TABLE IF EXISTS userBonuses;
DROP TABLE IF EXISTS userTasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS gameFees;
DROP TABLE IF EXISTS gameRounds;
DROP TABLE IF EXISTS gamePlayers;
DROP TABLE IF EXISTS gameRooms;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS accountSecurityEvents;
DROP TABLE IF EXISTS accountTransferOrders;
DROP TABLE IF EXISTS vpnAccounts;
DROP TABLE IF EXISTS serviceTransactions;
DROP TABLE IF EXISTS serviceOrders;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS giftDeposits;
DROP TABLE IF EXISTS collectibleOperations;
DROP TABLE IF EXISTS collectibleOwnership;
DROP TABLE IF EXISTS collectibleAssets;
DROP TABLE IF EXISTS assetFloorPrices;
DROP TABLE IF EXISTS assetMetadata;
DROP TABLE IF EXISTS starsPoolWithdrawals;
DROP TABLE IF EXISTS starsPoolEntries;
DROP TABLE IF EXISTS starsInvoices;
DROP TABLE IF EXISTS withdrawalAttempts;
DROP TABLE IF EXISTS withdrawals;
DROP TABLE IF EXISTS depositVerificationAttempts;
DROP TABLE IF EXISTS depositEvents;
DROP TABLE IF EXISTS deposits;
DROP TABLE IF EXISTS externalWalletBalances;
DROP TABLE IF EXISTS relayAccounts;
DROP TABLE IF EXISTS treasuryTransfers;
DROP TABLE IF EXISTS treasuryWallets;
DROP TABLE IF EXISTS ledgerEntries;
DROP TABLE IF EXISTS ledgerTransactions;
DROP TABLE IF EXISTS ledgerAccounts;
DROP TABLE IF EXISTS sessionWalletAttachments;
DROP TABLE IF EXISTS externalWalletAddresses;
DROP TABLE IF EXISTS referralRewards;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS userSessions;
DROP TABLE IF EXISTS userProfiles;
DROP TABLE IF EXISTS appUsers;
DROP TABLE IF EXISTS adminUsers;
DROP TABLE IF EXISTS platformSettings;
DROP TABLE IF EXISTS feeConfigurations;
DROP TABLE IF EXISTS assetTypes;
DROP TABLE IF EXISTS supportedNetworks;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS schemaMigrations;

-- Old/duplicate tables from the previous draft that are now removed:
DROP TABLE IF EXISTS userWallets;
DROP TABLE IF EXISTS walletAccounts;
DROP TABLE IF EXISTS ledgerEntriesV2;
DROP TABLE IF EXISTS auditLog;


-- =====================================================================
-- 0. MIGRATIONS
-- =====================================================================

CREATE TABLE schemaMigrations (
  version     INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  appliedAt   TEXT NOT NULL
);


-- =====================================================================
-- 1. REFERENCE DATA
-- =====================================================================

CREATE TABLE currencies (
  code       TEXT PRIMARY KEY,             -- 'TON', 'XTR' (stars), 'USD' (accounting only)
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('crypto','virtual','fiat')),
  decimals   INTEGER NOT NULL,             -- smallest-unit precision, e.g. TON=9, XTR=0
  isActive   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE supportedNetworks (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  currencyCode TEXT NOT NULL REFERENCES currencies(code),
  isActive     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE assetTypes (
  id          TEXT PRIMARY KEY,             -- collectible "collection" e.g. a specific gift model line, or 'username', 'phone_number'
  category    TEXT NOT NULL CHECK (category IN ('gift','username','phone_number','other')),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  createdAt   TEXT NOT NULL
);

-- Admin-tunable fee/percentage values (game rake %, withdrawal fee, referral %, etc.)
CREATE TABLE feeConfigurations (
  id               TEXT PRIMARY KEY,
  feeKey           TEXT NOT NULL UNIQUE,     -- e.g. 'game.rake_pct', 'withdrawal.ton.flat_fee'
  feeType          TEXT NOT NULL CHECK (feeType IN ('percent','fixed')),
  value            INTEGER NOT NULL,         -- percent as basis points (100 = 1%), or fixed in smallest unit
  currencyCode     TEXT REFERENCES currencies(code), -- null when feeType='percent'
  isActive         INTEGER NOT NULL DEFAULT 1,
  updatedAt        TEXT NOT NULL,
  updatedByAdminId TEXT
);

-- Generic admin-editable key/value config (min withdrawal amount, gift lock days, etc.)
CREATE TABLE platformSettings (
  settingKey       TEXT PRIMARY KEY,
  settingValue     TEXT NOT NULL,
  description      TEXT,
  updatedAt        TEXT NOT NULL,
  updatedByAdminId TEXT
);


-- =====================================================================
-- 2. ADMIN / BACKOFFICE USERS
-- =====================================================================

CREATE TABLE adminUsers (
  id             TEXT PRIMARY KEY,
  telegramUserId INTEGER UNIQUE,
  username       TEXT,
  displayName    TEXT,
  role           TEXT NOT NULL CHECK (role IN ('super_admin','finance','support','compliance','readonly')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  createdAt      TEXT NOT NULL
);


-- =====================================================================
-- 3. APP USERS
-- =====================================================================

CREATE TABLE appUsers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  telegramUserId  INTEGER NOT NULL UNIQUE,
  username        TEXT,
  profileName     TEXT,
  profileImageUrl TEXT,
  startedAt       TEXT NOT NULL,
  lastSeenAt      TEXT,
  isOnline        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','self_deleted')),
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

CREATE TABLE userProfiles (
  userId             INTEGER PRIMARY KEY REFERENCES appUsers(id),
  displayName        TEXT,
  languageCode       TEXT,
  timezone           TEXT,
  termsAcceptedAt    TEXT,
  privacyAcceptedAt  TEXT,
  createdAt          TEXT NOT NULL,
  updatedAt          TEXT NOT NULL
);

-- One row per client instance (Android app, desktop app, web app, or a
-- fresh reinstall). This is the unit that a wallet attaches to.
CREATE TABLE userSessions (
  id             TEXT PRIMARY KEY,
  userId         INTEGER NOT NULL REFERENCES appUsers(id),
  clientType     TEXT NOT NULL CHECK (clientType IN ('telegram_android','telegram_ios','telegram_desktop','telegram_web','telegram_macos','other')),
  clientName     TEXT,
  deviceId       TEXT,
  appVersion     TEXT,
  sessionStatus  TEXT NOT NULL DEFAULT 'active' CHECK (sessionStatus IN ('active','expired','revoked')),
  createdAt      TEXT NOT NULL,
  lastActivityAt TEXT,
  expiresAt      TEXT,
  revokedAt      TEXT
);
CREATE INDEX idx_userSessions_userId ON userSessions(userId);

CREATE TABLE referrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  referredUserId  INTEGER NOT NULL UNIQUE REFERENCES appUsers(id),
  referrerUserId  INTEGER NOT NULL REFERENCES appUsers(id),
  referralCode    TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  createdAt       TEXT NOT NULL
);
CREATE INDEX idx_referrals_referrerUserId ON referrals(referrerUserId);

-- Referral rewards can happen more than once (signup bonus, then a % of
-- every deposit or game rake for the referred user's lifetime), so this
-- is a log, not a single column on referrals.
CREATE TABLE referralRewards (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  referralId         INTEGER NOT NULL REFERENCES referrals(id),
  rewardType         TEXT NOT NULL CHECK (rewardType IN ('signup_bonus','deposit_share','game_rake_share')),
  triggerEntityType  TEXT,          -- 'deposit', 'gameFee', etc.
  triggerEntityId    TEXT,
  amount             INTEGER NOT NULL,
  currencyCode       TEXT NOT NULL REFERENCES currencies(code),
  ledgerTransactionId TEXT,
  createdAt          TEXT NOT NULL
);
CREATE INDEX idx_referralRewards_referralId ON referralRewards(referralId);


-- =====================================================================
-- 4. EXTERNAL WALLETS & SESSION ATTACHMENTS
-- =====================================================================

-- A TON wallet address, globally deduplicated by (network, address).
CREATE TABLE externalWalletAddresses (
  id                 TEXT PRIMARY KEY,
  networkId          TEXT NOT NULL REFERENCES supportedNetworks(id),
  walletAddress      TEXT NOT NULL,
  normalizedAddress  TEXT NOT NULL,
  addressLabel       TEXT,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  firstSeenAt        TEXT NOT NULL,
  lastVerifiedAt     TEXT,
  UNIQUE(networkId, normalizedAddress)
);

-- Periodic balance snapshots pulled from TonCenter/etc for reconciliation.
CREATE TABLE externalWalletBalances (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  externalWalletId  TEXT NOT NULL REFERENCES externalWalletAddresses(id),
  currencyCode      TEXT NOT NULL REFERENCES currencies(code),
  observedBalance   INTEGER NOT NULL,
  providerName      TEXT NOT NULL,
  observedAt        TEXT NOT NULL
);
CREATE INDEX idx_externalWalletBalances_walletId ON externalWalletBalances(externalWalletId);

-- THE FIX: one session can attach one wallet at a time. Disconnecting
-- a session's attachment never touches any other session's row.
CREATE TABLE sessionWalletAttachments (
  id                          TEXT PRIMARY KEY,
  sessionId                   TEXT NOT NULL REFERENCES userSessions(id),
  userId                      INTEGER NOT NULL REFERENCES appUsers(id),
  externalWalletId            TEXT NOT NULL REFERENCES externalWalletAddresses(id),
  attachmentStatus            TEXT NOT NULL CHECK (attachmentStatus IN ('active','disconnected')),
  connectionMethod            TEXT,      -- 'ton_connect', 'manual_address', etc.
  connectedAt                 TEXT NOT NULL,
  disconnectedAt              TEXT,
  lastOwnershipVerificationAt TEXT
);
CREATE INDEX idx_sessionWalletAttachments_sessionId ON sessionWalletAttachments(sessionId);
CREATE INDEX idx_sessionWalletAttachments_userId ON sessionWalletAttachments(userId);
-- Enforces "at most one ACTIVE wallet per session" without touching other sessions.
CREATE UNIQUE INDEX uq_sessionWalletAttachments_active_per_session
  ON sessionWalletAttachments(sessionId)
  WHERE attachmentStatus = 'active';


-- =====================================================================
-- 5. LEDGER (single source of truth for every balance)
-- =====================================================================

-- Every balance holder in the whole system is a row here: a user's
-- wallet, the hot/treasury wallet, the Stars pool, the fee pool.
CREATE TABLE ledgerAccounts (
  id               TEXT PRIMARY KEY,
  ownerType        TEXT NOT NULL CHECK (ownerType IN ('user','treasury','stars_pool','fee_pool','relay','system')),
  ownerId          TEXT,             -- appUsers.id (as text) for ownerType='user'; treasuryWallets.id for 'treasury'; NULL for singleton system accounts
  currencyCode     TEXT NOT NULL REFERENCES currencies(code),
  availableBalance INTEGER NOT NULL DEFAULT 0,  -- spendable now
  pendingBalance   INTEGER NOT NULL DEFAULT 0,  -- e.g. deposit seen on-chain but not yet confirmed
  lockedBalance    INTEGER NOT NULL DEFAULT 0,  -- e.g. Stars pool balance locked for 21 days, funds in an open game
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen')),
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL,
  UNIQUE(ownerType, ownerId, currencyCode)
);
CREATE INDEX idx_ledgerAccounts_owner ON ledgerAccounts(ownerType, ownerId);

CREATE TABLE ledgerTransactions (
  id                 TEXT PRIMARY KEY,
  transactionType    TEXT NOT NULL,   -- deposit_ton, deposit_stars, withdrawal_ton, game_stake, game_payout,
                                       -- game_fee, service_purchase, referral_reward, task_reward, bonus_grant,
                                       -- collectible_instant_sell, account_transfer_payout, treasury_rebalance, adjustment
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed','failed')),
  idempotencyKey     TEXT NOT NULL UNIQUE,
  externalReference  TEXT,
  description        TEXT,
  createdAt          TEXT NOT NULL,
  postedAt           TEXT,
  reversedAt         TEXT
);

-- Double-entry rows. For every transactionId, the sum of `amount`
-- across all entries in the same currencyCode must equal zero.
CREATE TABLE ledgerEntries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  transactionId    TEXT NOT NULL REFERENCES ledgerTransactions(id),
  ledgerAccountId  TEXT NOT NULL REFERENCES ledgerAccounts(id),
  currencyCode     TEXT NOT NULL REFERENCES currencies(code),
  amount           INTEGER NOT NULL,      -- positive = credit, negative = debit
  balanceBucket    TEXT NOT NULL DEFAULT 'available' CHECK (balanceBucket IN ('available','pending','locked')),
  entryType        TEXT NOT NULL,         -- free-text label for reporting, e.g. 'deposit_credit', 'game_stake_debit'
  createdAt        TEXT NOT NULL
);
CREATE INDEX idx_ledgerEntries_transactionId ON ledgerEntries(transactionId);
CREATE INDEX idx_ledgerEntries_ledgerAccountId ON ledgerEntries(ledgerAccountId);


-- =====================================================================
-- 6. TREASURY (admin/hot wallets)
-- =====================================================================

CREATE TABLE treasuryWallets (
  id               TEXT PRIMARY KEY,
  walletName       TEXT NOT NULL,
  purpose          TEXT NOT NULL CHECK (purpose IN ('hot_withdrawal','cold_storage','fee_collector','gift_purchase_reserve','other')),
  networkId        TEXT NOT NULL REFERENCES supportedNetworks(id),
  externalWalletId TEXT REFERENCES externalWalletAddresses(id),
  keyReference     TEXT,             -- pointer into your KMS/secrets manager, never the raw key
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  createdAt        TEXT NOT NULL
);

CREATE TABLE treasuryTransfers (
  id                       TEXT PRIMARY KEY,
  fromTreasuryWalletId     TEXT NOT NULL REFERENCES treasuryWallets(id),
  toTreasuryWalletId       TEXT REFERENCES treasuryWallets(id),
  toExternalWalletId       TEXT REFERENCES externalWalletAddresses(id),  -- e.g. paying out a user withdrawal
  purpose                  TEXT NOT NULL CHECK (purpose IN ('user_withdrawal','rebalance','gift_purchase','fee_sweep','other')),
  currencyCode             TEXT NOT NULL REFERENCES currencies(code),
  amount                   INTEGER NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','completed','failed')),
  externalTransactionHash  TEXT,
  initiatedByAdminId       TEXT REFERENCES adminUsers(id),
  createdAt                TEXT NOT NULL,
  completedAt              TEXT
);
CREATE INDEX idx_treasuryTransfers_fromWallet ON treasuryTransfers(fromTreasuryWalletId);

-- Telegram accounts you control that gifts get sent to.
CREATE TABLE relayAccounts (
  id               TEXT PRIMARY KEY,
  telegramAccountId INTEGER NOT NULL UNIQUE,
  displayLabel     TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','full','suspended')),
  createdAt        TEXT NOT NULL
);


-- =====================================================================
-- 7. TON DEPOSITS & WITHDRAWALS (on-chain path)
-- =====================================================================

CREATE TABLE deposits (
  id                          TEXT PRIMARY KEY,
  userId                      INTEGER NOT NULL REFERENCES appUsers(id),
  sessionId                   TEXT REFERENCES userSessions(id),
  sessionWalletAttachmentId   TEXT REFERENCES sessionWalletAttachments(id),
  currencyCode                TEXT NOT NULL REFERENCES currencies(code),
  networkId                   TEXT REFERENCES supportedNetworks(id),
  expectedAmount              INTEGER NOT NULL,
  verifiedAmount              INTEGER,
  paymentRequest              TEXT,       -- TonConnect payload / deep link sent to the wallet
  status                      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','confirmed','credited','expired','failed')),
  idempotencyKey              TEXT NOT NULL UNIQUE,
  externalTransactionHash     TEXT,
  providerName                TEXT,       -- 'toncenter'
  ledgerTransactionId         TEXT REFERENCES ledgerTransactions(id),
  createdAt                   TEXT NOT NULL,
  expiresAt                   TEXT,
  confirmedAt                 TEXT,
  creditedAt                  TEXT
);
CREATE INDEX idx_deposits_userId ON deposits(userId);

CREATE TABLE depositEvents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  depositId       TEXT NOT NULL REFERENCES deposits(id),
  eventType       TEXT NOT NULL,
  providerName    TEXT NOT NULL,
  externalEventId TEXT,
  payloadJson     TEXT,
  observedAt      TEXT NOT NULL
);
CREATE INDEX idx_depositEvents_depositId ON depositEvents(depositId);

CREATE TABLE depositVerificationAttempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  depositId     TEXT NOT NULL REFERENCES deposits(id),
  providerName  TEXT NOT NULL,
  requestType   TEXT NOT NULL,
  requestJson   TEXT,
  responseJson  TEXT,
  result        TEXT NOT NULL,
  errorMessage  TEXT,
  createdAt     TEXT NOT NULL
);
CREATE INDEX idx_depositVerificationAttempts_depositId ON depositVerificationAttempts(depositId);

CREATE TABLE withdrawals (
  id                        TEXT PRIMARY KEY,
  userId                    INTEGER NOT NULL REFERENCES appUsers(id),
  sessionId                 TEXT REFERENCES userSessions(id),
  sessionWalletAttachmentId TEXT REFERENCES sessionWalletAttachments(id),
  externalWalletId          TEXT NOT NULL REFERENCES externalWalletAddresses(id),
  treasuryWalletId          TEXT REFERENCES treasuryWallets(id),
  currencyCode              TEXT NOT NULL REFERENCES currencies(code),
  networkId                 TEXT NOT NULL REFERENCES supportedNetworks(id),
  requestedAmount           INTEGER NOT NULL,
  networkFee                INTEGER NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','submitted','completed','failed','cancelled')),
  idempotencyKey            TEXT NOT NULL UNIQUE,
  externalTransactionHash   TEXT,
  failureReason             TEXT,
  ledgerTransactionId       TEXT REFERENCES ledgerTransactions(id),
  createdAt                 TEXT NOT NULL,
  submittedAt               TEXT,
  completedAt               TEXT
);
CREATE INDEX idx_withdrawals_userId ON withdrawals(userId);

CREATE TABLE withdrawalAttempts (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  withdrawalId             TEXT NOT NULL REFERENCES withdrawals(id),
  providerName             TEXT NOT NULL,
  attemptNumber            INTEGER NOT NULL,
  requestJson              TEXT,
  responseJson             TEXT,
  status                   TEXT NOT NULL,
  externalTransactionHash  TEXT,
  createdAt                TEXT NOT NULL,
  completedAt              TEXT
);
CREATE INDEX idx_withdrawalAttempts_withdrawalId ON withdrawalAttempts(withdrawalId);


-- =====================================================================
-- 8. TELEGRAM STARS PAYMENTS (locked ~21 days, withdrawn via Fragment)
-- =====================================================================

CREATE TABLE starsInvoices (
  id                        TEXT PRIMARY KEY,
  userId                    INTEGER NOT NULL REFERENCES appUsers(id),
  sessionId                 TEXT REFERENCES userSessions(id),
  purpose                   TEXT NOT NULL CHECK (purpose IN ('wallet_topup','buy_premium','buy_ton','service_payment')),
  starsAmount               INTEGER NOT NULL,
  invoicePayload            TEXT NOT NULL UNIQUE,
  telegramPaymentChargeId   TEXT UNIQUE,
  providerPaymentChargeId   TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
  ledgerTransactionId       TEXT REFERENCES ledgerTransactions(id),
  createdAt                 TEXT NOT NULL,
  paidAt                    TEXT
);
CREATE INDEX idx_starsInvoices_userId ON starsInvoices(userId);

-- Every paid Stars invoice becomes a locked chunk in the bot's Stars
-- balance. eligibleWithdrawAt = paidAt + 21 days.
CREATE TABLE starsPoolEntries (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  starsInvoiceId       TEXT NOT NULL UNIQUE REFERENCES starsInvoices(id),
  starsAmount          INTEGER NOT NULL,
  receivedAt           TEXT NOT NULL,
  eligibleWithdrawAt   TEXT NOT NULL,
  withdrawalId         TEXT,   -- set once swept into a starsPoolWithdrawals batch
  createdAt            TEXT NOT NULL
);
CREATE INDEX idx_starsPoolEntries_withdrawalId ON starsPoolEntries(withdrawalId);

-- Batched withdrawal of eligible Stars via Fragment.
CREATE TABLE starsPoolWithdrawals (
  id                  TEXT PRIMARY KEY,
  totalStarsAmount    INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','submitted','completed','failed')),
  fragmentReference   TEXT,
  requestedAt         TEXT NOT NULL,
  completedAt         TEXT,
  createdAt           TEXT NOT NULL
);


-- =====================================================================
-- 9. COLLECTIBLES (gifts, usernames, numbers)
-- =====================================================================

CREATE TABLE assetMetadata (
  id             TEXT PRIMARY KEY,
  assetTypeId    TEXT NOT NULL REFERENCES assetTypes(id),
  externalAssetId TEXT,     -- Fragment/Telegram collection id
  model          TEXT,
  symbol         TEXT,
  backdrop       TEXT,
  imageUrl       TEXT,
  metadataJson   TEXT,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);

-- Latest known floor price per asset type, plus a history for auditing
-- what price a user was actually offered at instant-sell time.
CREATE TABLE assetFloorPrices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assetTypeId   TEXT NOT NULL REFERENCES assetTypes(id),
  currencyCode  TEXT NOT NULL REFERENCES currencies(code),
  floorPrice    INTEGER NOT NULL,
  source        TEXT,
  observedAt    TEXT NOT NULL
);
CREATE INDEX idx_assetFloorPrices_assetTypeId_observedAt ON assetFloorPrices(assetTypeId, observedAt);

-- A user-initiated request to send a gift in; created BEFORE the gift
-- physically arrives, so you know what you're waiting for.
CREATE TABLE giftDeposits (
  id                       TEXT PRIMARY KEY,
  userId                   INTEGER NOT NULL REFERENCES appUsers(id),
  sessionId                TEXT REFERENCES userSessions(id),
  relayAccountId           TEXT NOT NULL REFERENCES relayAccounts(id),
  expectedAssetTypeId      TEXT REFERENCES assetTypes(id),
  status                   TEXT NOT NULL DEFAULT 'awaiting_transfer' CHECK (status IN ('awaiting_transfer','received','locked','available','match_failed','expired')),
  telegramTransferMessageId TEXT,
  receivedAt               TEXT,
  unlockAt                 TEXT,     -- Telegram's own gift-transfer lock, not yours
  verifiedAt               TEXT,
  collectibleAssetId       TEXT,     -- filled in once matched to an actual asset below
  createdAt                TEXT NOT NULL,
  expiresAt                TEXT
);
CREATE INDEX idx_giftDeposits_userId ON giftDeposits(userId);

-- The actual gift instance, wherever it currently sits (relay account
-- custody, or already paid out/withdrawn).
CREATE TABLE collectibleAssets (
  id                    TEXT PRIMARY KEY,
  assetTypeId           TEXT NOT NULL REFERENCES assetTypes(id),
  metadataId            TEXT REFERENCES assetMetadata(id),
  externalAssetId       TEXT,
  giftDepositId         TEXT REFERENCES giftDeposits(id),
  currentRelayAccountId TEXT REFERENCES relayAccounts(id),
  currentOwnerUserId    INTEGER REFERENCES appUsers(id),
  currentStatus         TEXT NOT NULL CHECK (currentStatus IN ('in_relay_locked','in_relay_available','sold_to_platform','withdrawn_to_user')),
  receivedAt            TEXT,
  unlockedAt            TEXT,
  createdAt             TEXT NOT NULL,
  updatedAt             TEXT NOT NULL
);
CREATE INDEX idx_collectibleAssets_currentOwnerUserId ON collectibleAssets(currentOwnerUserId);

-- History of custody/ownership changes for one asset (audit trail).
CREATE TABLE collectibleOwnership (
  id                        TEXT PRIMARY KEY,
  collectibleAssetId        TEXT NOT NULL REFERENCES collectibleAssets(id),
  userId                    INTEGER REFERENCES appUsers(id),
  custodyType               TEXT NOT NULL CHECK (custodyType IN ('relay','user_external')),
  ownershipStatus           TEXT NOT NULL CHECK (ownershipStatus IN ('active','released')),
  externalAccountReference  TEXT,
  acquiredAt                TEXT NOT NULL,
  releasedAt                TEXT
);
CREATE INDEX idx_collectibleOwnership_assetId ON collectibleOwnership(collectibleAssetId);

-- User actions on a gift: confirm receipt, instant-sell, withdraw.
CREATE TABLE collectibleOperations (
  id                  TEXT PRIMARY KEY,
  collectibleAssetId  TEXT NOT NULL REFERENCES collectibleAssets(id),
  userId              INTEGER REFERENCES appUsers(id),
  operationType       TEXT NOT NULL CHECK (operationType IN ('deposit_confirm','instant_sell','withdraw_request','withdraw_complete')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  salePriceAmount     INTEGER,             -- filled for instant_sell
  saleCurrencyCode    TEXT REFERENCES currencies(code),
  ledgerTransactionId TEXT REFERENCES ledgerTransactions(id),
  externalReference   TEXT,
  detailsJson         TEXT,
  createdAt           TEXT NOT NULL,
  completedAt         TEXT
);
CREATE INDEX idx_collectibleOperations_assetId ON collectibleOperations(collectibleAssetId);


-- =====================================================================
-- 10. SERVICES (stars<->ton, premium, VPN, account resale)
-- =====================================================================

CREATE TABLE services (
  id          TEXT PRIMARY KEY,
  serviceCode TEXT NOT NULL UNIQUE,   -- 'buy_stars_with_ton', 'buy_ton_with_stars', 'buy_premium', 'vpn', 'account_resale'
  name        TEXT NOT NULL,
  description TEXT,
  serviceType TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  createdAt   TEXT NOT NULL
);

CREATE TABLE serviceOrders (
  id             TEXT PRIMARY KEY,
  userId         INTEGER NOT NULL REFERENCES appUsers(id),
  serviceId      TEXT NOT NULL REFERENCES services(id),
  paymentMethod  TEXT NOT NULL CHECK (paymentMethod IN ('ton_wallet','stars_invoice')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','failed','refunded')),
  inputJson      TEXT,
  resultJson     TEXT,
  createdAt      TEXT NOT NULL,
  completedAt    TEXT
);
CREATE INDEX idx_serviceOrders_userId ON serviceOrders(userId);

CREATE TABLE serviceTransactions (
  id                   TEXT PRIMARY KEY,
  serviceOrderId       TEXT NOT NULL REFERENCES serviceOrders(id),
  ledgerTransactionId  TEXT NOT NULL REFERENCES ledgerTransactions(id),
  transactionPurpose   TEXT NOT NULL,   -- 'payment', 'refund'
  createdAt            TEXT NOT NULL
);
CREATE INDEX idx_serviceTransactions_orderId ON serviceTransactions(serviceOrderId);

CREATE TABLE vpnAccounts (
  id                    TEXT PRIMARY KEY,
  serviceOrderId        TEXT NOT NULL UNIQUE REFERENCES serviceOrders(id),
  provider              TEXT NOT NULL,
  credentialsEncrypted  TEXT NOT NULL,   -- encrypt at the app layer, never store plaintext
  expiresAt             TEXT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  createdAt             TEXT NOT NULL
);

-- Telegram account resale flow. Credentials must be purged (purgedAt
-- set, credentialsEncrypted nulled) as soon as the transfer completes.
CREATE TABLE accountTransferOrders (
  id                        TEXT PRIMARY KEY,
  sellerUserId              INTEGER NOT NULL REFERENCES appUsers(id),
  telegramAccountPhone      TEXT,
  telegramAccountUsername   TEXT,
  status                    TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','awaiting_code','awaiting_password','verifying','changing_security','completed','failed','rejected')),
  accountReference          TEXT,
  credentialsEncrypted      TEXT,       -- transient; must be purged after completion
  purgedAt                  TEXT,
  verificationStatus        TEXT NOT NULL DEFAULT 'pending' CHECK (verificationStatus IN ('pending','verified','rejected')),
  complianceNotes           TEXT,
  agreedPriceAmount         INTEGER,
  agreedPriceCurrencyCode   TEXT REFERENCES currencies(code),
  payoutLedgerTransactionId TEXT REFERENCES ledgerTransactions(id),
  createdAt                 TEXT NOT NULL,
  completedAt               TEXT
);
CREATE INDEX idx_accountTransferOrders_sellerUserId ON accountTransferOrders(sellerUserId);

CREATE TABLE accountSecurityEvents (
  id              TEXT PRIMARY KEY,
  transferOrderId TEXT NOT NULL REFERENCES accountTransferOrders(id),
  stepName        TEXT NOT NULL,   -- 'login_code_requested', 'other_sessions_terminated', '2fa_changed', 'recovery_email_changed'
  eventType       TEXT NOT NULL,
  status          TEXT NOT NULL,
  detailsJson     TEXT,
  createdAt       TEXT NOT NULL
);
CREATE INDEX idx_accountSecurityEvents_orderId ON accountSecurityEvents(transferOrderId);


-- =====================================================================
-- 11. PVP GAMES
-- =====================================================================

CREATE TABLE games (
  id        TEXT PRIMARY KEY,
  gameCode  TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  gameType  TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  createdAt TEXT NOT NULL
);

CREATE TABLE gameRooms (
  id           TEXT PRIMARY KEY,
  gameId       TEXT NOT NULL REFERENCES games(id),
  status       TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','completed','cancelled')),
  stakeAmount  INTEGER NOT NULL,
  currencyCode TEXT NOT NULL REFERENCES currencies(code),
  createdAt    TEXT NOT NULL,
  startedAt    TEXT,
  completedAt  TEXT
);
CREATE INDEX idx_gameRooms_gameId ON gameRooms(gameId);

CREATE TABLE gamePlayers (
  id                   TEXT PRIMARY KEY,
  roomId               TEXT NOT NULL REFERENCES gameRooms(id),
  userId               INTEGER NOT NULL REFERENCES appUsers(id),
  playerStatus         TEXT NOT NULL DEFAULT 'joined' CHECK (playerStatus IN ('joined','left','disqualified')),
  stakeLedgerTransactionId TEXT REFERENCES ledgerTransactions(id),  -- the debit that locked their stake
  joinedAt             TEXT NOT NULL
);
CREATE INDEX idx_gamePlayers_roomId ON gamePlayers(roomId);
CREATE INDEX idx_gamePlayers_userId ON gamePlayers(userId);

-- resultHash/proofJson give you the provably-fair trail so you can show
-- "no bots, no rigging" evidence per round.
CREATE TABLE gameRounds (
  id             TEXT PRIMARY KEY,
  roomId         TEXT NOT NULL REFERENCES gameRooms(id),
  resultStatus   TEXT NOT NULL DEFAULT 'pending' CHECK (resultStatus IN ('pending','completed','voided')),
  winnerPlayerId TEXT REFERENCES gamePlayers(id),
  resultHash     TEXT,
  proofJson      TEXT,
  createdAt      TEXT NOT NULL,
  finalizedAt    TEXT
);
CREATE INDEX idx_gameRounds_roomId ON gameRounds(roomId);

CREATE TABLE gameFees (
  id                  TEXT PRIMARY KEY,
  roundId             TEXT NOT NULL REFERENCES gameRounds(id),
  winnerPlayerId      TEXT NOT NULL REFERENCES gamePlayers(id),
  currencyCode        TEXT NOT NULL REFERENCES currencies(code),
  grossAmount         INTEGER NOT NULL,
  feeAmount           INTEGER NOT NULL,   -- e.g. 1% rake, driven by feeConfigurations
  netAmount           INTEGER NOT NULL,
  ledgerTransactionId TEXT REFERENCES ledgerTransactions(id),
  createdAt           TEXT NOT NULL
);
CREATE INDEX idx_gameFees_roundId ON gameFees(roundId);


-- =====================================================================
-- 12. TASKS & BONUSES
-- =====================================================================

CREATE TABLE tasks (
  id                 TEXT PRIMARY KEY,
  taskCode           TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  rewardCurrencyCode TEXT NOT NULL REFERENCES currencies(code),
  rewardAmount       INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))
);

CREATE TABLE userTasks (
  id                  TEXT PRIMARY KEY,
  taskId              TEXT NOT NULL REFERENCES tasks(id),
  userId              INTEGER NOT NULL REFERENCES appUsers(id),
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','reward_claimed')),
  ledgerTransactionId TEXT REFERENCES ledgerTransactions(id),
  completedAt         TEXT
);
CREATE INDEX idx_userTasks_userId ON userTasks(userId);

CREATE TABLE userBonuses (
  id                  TEXT PRIMARY KEY,
  userId              INTEGER NOT NULL REFERENCES appUsers(id),
  bonusType           TEXT NOT NULL,
  amount              INTEGER NOT NULL,
  currencyCode        TEXT NOT NULL REFERENCES currencies(code),
  status              TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','expired','revoked')),
  expiresAt           TEXT,
  ledgerTransactionId TEXT REFERENCES ledgerTransactions(id),
  createdAt           TEXT NOT NULL
);
CREATE INDEX idx_userBonuses_userId ON userBonuses(userId);


-- =====================================================================
-- 13. AUDIT
-- =====================================================================

CREATE TABLE adminAuditLog (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  adminUserId  TEXT REFERENCES adminUsers(id),   -- NULL for system-generated events
  userId       INTEGER REFERENCES appUsers(id),
  sessionId    TEXT REFERENCES userSessions(id),
  action       TEXT NOT NULL,
  entityType   TEXT,
  entityId     TEXT,
  detailsJson  TEXT,
  createdAt    TEXT NOT NULL
);
CREATE INDEX idx_adminAuditLog_userId ON adminAuditLog(userId);
CREATE INDEX idx_adminAuditLog_adminUserId ON adminAuditLog(adminUserId);


-- =====================================================================
-- SEED DATA (minimal, adjust as needed)
-- =====================================================================

INSERT INTO currencies (code, name, kind, decimals, isActive) VALUES
  ('TON', 'Toncoin', 'crypto', 9, 1),
  ('XTR', 'Telegram Stars', 'virtual', 0, 1);

INSERT INTO supportedNetworks (id, name, currencyCode, isActive) VALUES
  ('ton-mainnet', 'TON Mainnet', 'TON', 1);
