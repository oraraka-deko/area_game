import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ArenaGameEngine } from './server/stateMachine.js';
import { verifyRoundOutcome } from './server/provablyFair.js';
import { askArenaMaster } from './server/geminiAnnouncer.js';
import { ChatMessage } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

function broadcast(payload: any) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendChat(msg: ChatMessage) {
  broadcast({
    type: 'CHAT_MESSAGE',
    message: msg
  });
}

// Instantiate authoritative game engine
const gameEngine = new ArenaGameEngine({
  broadcast,
  sendChat
});
gameEngine.start();

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  // Send initial state & history immediately on connect
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    state: gameEngine.getState(),
    history: gameEngine.getHistory()
  }));

  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      if (msg.type === 'PLACE_BET') {
        const result = gameEngine.placeBet({
          playerId: msg.playerId,
          username: msg.username,
          avatar: msg.avatar,
          color: msg.color,
          creditAmount: msg.creditAmount,
          relics: msg.relics
        });
        ws.send(JSON.stringify({
          type: 'BET_RESPONSE',
          success: result.success,
          error: result.error
        }));
      } else if (msg.type === 'CHAT_MESSAGE') {
        if (msg.text && typeof msg.text === 'string' && msg.text.trim()) {
          const chatMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: msg.username || 'Anonymous',
            avatar: msg.avatar,
            text: msg.text.trim().substring(0, 200),
            timestamp: Date.now()
          };
          broadcast({
            type: 'CHAT_MESSAGE',
            message: chatMsg
          });
        }
      } else if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      } else if (msg.type === 'DEV_ADD_PLAYER') {
        const result = gameEngine.addRandomPlayer(msg.creditAmount);
        ws.send(JSON.stringify({
          type: 'DEV_ADD_PLAYER_RESPONSE',
          success: result.success,
          player: result.player,
          error: result.error
        }));
      } else if (msg.type === 'DEV_START_ROUND') {
        gameEngine.forceStartCountdown();
      } else if (msg.type === 'DEV_ROLL_NOW') {
        gameEngine.forceRollNow();
      } else if (msg.type === 'DEV_RESET_ROUND') {
        gameEngine.forceResetRound();
      } else if (msg.type === 'DEV_SET_AUTO_START') {
        gameEngine.setAutoStart(Boolean(msg.autoStart));
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/history', (req, res) => {
  res.json({ history: gameEngine.getHistory() });
});

// Dev Controls REST endpoints
app.post('/api/dev/add-player', (req, res) => {
  const { creditAmount } = req.body || {};
  const result = gameEngine.addRandomPlayer(creditAmount !== undefined ? Number(creditAmount) : undefined);
  res.json(result);
});

app.post('/api/dev/start-round', (req, res) => {
  gameEngine.forceStartCountdown();
  res.json({ success: true });
});

app.post('/api/dev/roll-now', (req, res) => {
  gameEngine.forceRollNow();
  res.json({ success: true });
});

app.post('/api/dev/reset-round', (req, res) => {
  gameEngine.forceResetRound();
  res.json({ success: true });
});

app.post('/api/dev/auto-start', (req, res) => {
  const { enabled } = req.body || {};
  gameEngine.setAutoStart(Boolean(enabled));
  res.json({ success: true, autoStart: gameEngine.autoStart });
});

// Provably Fair Verification Endpoint
app.post('/api/verify', (req, res) => {
  try {
    const { serverSeed, claimedHash, roundId, totalPool, playerBets } = req.body;
    if (!serverSeed || !claimedHash || roundId === undefined || totalPool === undefined) {
      return res.status(400).json({ error: 'Missing required parameters for verification' });
    }

    const verification = verifyRoundOutcome(
      serverSeed,
      claimedHash,
      Number(roundId),
      Number(totalPool),
      playerBets || []
    );

    res.json(verification);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// Ask AI Arena Master
app.post('/api/ask-ai', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const currentState = gameEngine.getState();
    const answer = await askArenaMaster(question, {
      roundId: currentState.roundId,
      pot: currentState.totalPool,
      status: currentState.status
    });

    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

// Vite Middleware integration for development
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
