

export interface Player {
    id: string;
    name: string;
    seat: number;
    stats?: {
        health: number;
        armor: number;
    };
    personality?: 'fire-conjuror' | 'water-conjuror' | 'earth-conjuror' | 'air-conjuror' | 'avatar';
}

// --- KILLER ESCAPE TYPES ---
  
export interface CardDefinition {
    id: string;
    name: string;
    type: 'Item' | 'Action' | 'Goal' | 'Special' | 'Hazard';
    description: string;
    quantity: number;
    playable: boolean;
    special?: string;
}

export interface KillerEscapeGameState {
    status: 'waiting' | 'playing' | 'finished';
    actionLog?: string[];
    deck?: CardDefinition[];
    playerHands?: { [playerId: string]: CardDefinition[] };
    discardPile?: CardDefinition[];
    turnOrder?: string[];
    currentPlayerIndex?: number;
    turnDirection?: number;
    completedGoals?: { [goalName: string]: string[] };
    eliminatedPlayers?: { [playerId: string]: any };
    survivors?: { [playerId: string]: any };
    zombieRollModifier?: number;
    initialPlayerCount?: number;
    statsRecorded?: boolean;
}

export interface Game {
    id:string;
    type: 'killer-escape';
    creator: {
        id: string;
        name: string;
    };
    players: Player[];
    expectedPlayers: number;
    state: KillerEscapeGameState;
    createdAt: string;
    deletedAt?: number; // Timestamp for when the game should be deleted
    expansion: 'zombie-edition' | null;
}


// --- Bot Specific Types ---
export type BotActionType = 'PLAY_CARD' | 'DRAW_CARD';

export interface BotActionChoice {
  type: 'PLAY_CARD' | 'DRAW_CARD';
  cardName?: string;
  options: any;
  priority: number; // 0 (lowest) to 10 (highest)
}

export interface BotAction {
    type: BotActionType;
    botId: string;
    cardName?: string;
    cardName1?: string; // For playing pairs like Skeleton Keys Part 1
    cardName2?: string; // For playing pairs like Skeleton Keys Part 2
    targetPlayerId?: string;
    peekChoice?: 'deck' | 'corpse';
    cardToTake?: string;
}

// --- API Payloads ---

export interface DrawCardResult {
    drawnCard: any;
    isTrap: boolean;
    isKiller: boolean;
    isEliminated: boolean;
    newHand?: any[];
    message: string;
    turnEnded: boolean;
}

// --- Stats Types ---
export interface PlayerCountStats {
  finished: number;
  survivedTeam: number;
  survivedWithKey: number;
  eliminated: number;
  sacrificed: number;
}

export interface GameStats {
  baseGame: { [key: string]: PlayerCountStats };
  zombieEdition: { [key: string]: PlayerCountStats };
}

