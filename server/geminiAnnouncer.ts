import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client with proper telemetry headers
let ai: GoogleGenAI | null = null;

if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

export interface AnnouncerEvent {
  type: 'UNDERDOG_WIN' | 'WHALE_DOMINATION' | 'POT_SPIKE' | 'GRUDGE_MATCH' | 'CLOSE_CALL' | 'ROUND_START';
  roundId: number;
  winnerName?: string;
  winnerChance?: number;
  potAmount: number;
  playerCount?: number;
  topOpponent?: string;
}

const FALLBACK_COMMENTARY: Record<AnnouncerEvent['type'], string[]> = {
  UNDERDOG_WIN: [
    'HOLY SHOCKWAVE! Against impossible odds, the underdog takes the entire bag home!',
    'The math broke! An absolute miracle snipe shocks the arena audience!',
    'Call the paramedics, the whales just got humbled by pure cryptographic chaos!',
    'Unbelievable! A lightning strike in the territory gives the low-roller glory!'
  ],
  WHALE_DOMINATION: [
    'The titan claims what was rightfully theirs! Clean sweep for the arena heavyweight.',
    'Total territorial lockdown! The whale swallows the pot whole.',
    'Never bet against momentum—dominance asserted in cold blood!'
  ],
  POT_SPIKE: [
    'ALARM! We just broke a gargantuan pot milestone—sweat is dripping on the glass!',
    'Sirens blazing! The pot is overflowing with liquid credits and rare relics!',
    'Massive stakes on the board! Who walks away a legend tonight?'
  ],
  GRUDGE_MATCH: [
    'Two titans enter the square, only one leaves with the bag!',
    'Tension reaches absolute zero in this ferocious 1v1 territory showdown!'
  ],
  CLOSE_CALL: [
    'The orb scraped the border line by mere pixels! What an agonizing finish!',
    'Pixel-perfect precision! You could not slide a nanometer between those slices!'
  ],
  ROUND_START: [
    'Gates are wide open! Stake your territory before the cryptographic hammer drops!',
    'New seed locked in SHA-256! May the provably fair entropy be in your favor!'
  ]
};

function getRandomFallback(type: AnnouncerEvent['type']): string {
  const list = FALLBACK_COMMENTARY[type] || FALLBACK_COMMENTARY.UNDERDOG_WIN;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generate a witty, 1-sentence hype commentary for live events.
 */
export async function generateArenaCommentary(event: AnnouncerEvent): Promise<string> {
  if (!ai || !process.env.GEMINI_API_KEY) {
    return getRandomFallback(event.type);
  }

  const prompt = `You are "CYBER-VOX 9000", an eccentric, razor-sharp, hype cyberpunk arena announcer for a live provably fair 2D territory jackpot game.
Generate exactly ONE witty, electrifying, 1-sentence commentary line (maximum 20 words, uppercase accents allowed, cyberpunk slang welcome, no hashtags, no quotes).

Event Context:
- Type: ${event.type}
- Round ID: #${event.roundId}
- Pot Total: ${event.potAmount.toLocaleString()} Credits
- Winner: ${event.winnerName || 'N/A'} (Win Chance: ${event.winnerChance ? (event.winnerChance * 100).toFixed(1) + '%' : 'N/A'})
- Player Count: ${event.playerCount || 2}
- Top Opponent: ${event.topOpponent || 'rivals'}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an electrifying cyberpunk esports announcer. Always reply with only a single high-energy punchline sentence under 20 words. No Markdown formatting or quotation marks.',
        temperature: 0.9,
      },
    });

    const text = response.text?.trim().replace(/^["']|["']$/g, '');
    if (text && text.length > 5 && text.length < 200) {
      return text;
    }
    return getRandomFallback(event.type);
  } catch (err) {
    console.warn('Gemini Announcer API error, falling back to scripted line:', err);
    return getRandomFallback(event.type);
  }
}

/**
 * Ask the Game Master / Assistant a question about the game or provably fair mechanics.
 */
export async function askArenaMaster(question: string, context?: any): Promise<string> {
  if (!ai || !process.env.GEMINI_API_KEY) {
    return "The Provably Fair engine uses SHA-256 for public commitments and HMAC-SHA256(server_seed, roundId) mod totalPool to guarantee zero manipulation. Every round can be independently verified!";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: question,
      config: {
        systemInstruction: `You are the AI Game Master and Provably Fair diagnostic assistant for the 2D Territory Arena.
Explain rules, mathematical fairness (HMAC-SHA256, server seed commitments, inverse rake scaling 1-25%), and game strategy concisely and warmly in 2-3 sentences.
Current game context: ${JSON.stringify(context || {})}`,
        temperature: 0.7,
      },
    });

    return response.text?.trim() || "Provably fair verification ensures that neither players nor the house can alter the outcome after bets lock in.";
  } catch (err) {
    console.warn('Gemini Arena Master error:', err);
    return "The Provably Fair engine uses SHA-256 for public commitments and HMAC-SHA256(server_seed, roundId) mod totalPool to guarantee zero manipulation.";
  }
}
