
import { Game, CardDefinition, KillerEscapeGameState, GameStats } from './types';
import { arrayUnion, DocumentData, increment, serverTimestamp } from 'firebase/firestore';
import { allKillerEscapeCards } from './cards';

/**
 * Checks if the game has ended and updates the state if it has.
 * Modifies the 'updates' object directly.
 * @returns true if the game has ended, false otherwise.
 */
export function checkEndGame(game: Game, updates: any): boolean {
    const totalPlayers = game.players.length;
    
    // Get latest counts including pending updates
    let eliminatedCount = Object.keys(game.state.eliminatedPlayers || {}).length;
    let survivorCount = Object.keys(game.state.survivors || {}).length;

    // Account for players being eliminated or surviving in the current transaction
    for (const key in updates) {
        if (key.startsWith('state.eliminatedPlayers.')) {
            // Make sure we're not just updating a sub-property of an already eliminated player
            if (!game.state.eliminatedPlayers?.[key.split('.')[2]]) {
                eliminatedCount++;
            }
        }
        if (key.startsWith('state.survivors.')) {
            if (!game.state.survivors?.[key.split('.')[2]]) {
                survivorCount++;
            }
        }
    }
    
    const activePlayerCount = totalPlayers - (eliminatedCount + survivorCount);

    const goals = { ...game.state.completedGoals, ...(updates['state.completedGoals'] || {}) };
    const goalNames = ["Build a Trap", "Repair a Radio", "Repair a Car"];
    for (const goalName of goalNames) {
        let currentCount = game.state.completedGoals?.[goalName]?.length || 0;
        
        // Check if the goal was updated in this transaction
        if (updates[`state.completedGoals.${goalName}`]) {
            currentCount = updates[`state.completedGoals.${goalName}`].length;
        }

        if (currentCount >= 6) {
            updates['state.status'] = 'finished';
            updates['state.actionLog'] = arrayUnion(`${goalName} was completed! The remaining players survived!`);
            updates['state.statsRecorded'] = false;
            return true;
        }
    }
    
    // Check if a single player survived via skeleton key, which would also end the game
    if (survivorCount > 0 && activePlayerCount + survivorCount < totalPlayers) {
         const survivors = { ...(game.state.survivors || {}), ...(updates['state.survivors'] || {}) };
         const keySurvivor = Object.values(survivors).some((s: any) => s.method === 'Escaped with Skeleton Key');
         if (keySurvivor) {
            updates['state.status'] = 'finished';
            updates['state.actionLog'] = arrayUnion(`A player escaped with a skeleton key! The game is over.`);
            updates['state.statsRecorded'] = false;
            return true;
         }
    }


    return false;
}

/**
 * Advances the turn to the next active player.
 * Modifies the 'updates' object directly.
 */
export function advanceTurn(game: Game, updates: any) {
    const nextPlayerIdOverride = updates.nextPlayerIdOverride;

    if (nextPlayerIdOverride) {
        const nextPlayerIndex = game.state.turnOrder!.findIndex((id: string) => id === nextPlayerIdOverride);
        if (nextPlayerIndex !== -1) {
            updates['state.currentPlayerIndex'] = nextPlayerIndex;
            delete updates.nextPlayerIdOverride; // Consume the override
            handleHordeRoll(game, updates);
            return;
        }
        // If override player not found, fall through to normal turn advancement
        delete updates.nextPlayerIdOverride;
    }
    
    let nextPlayerIndex = game.state.currentPlayerIndex!;
    let nextPlayerId = '';
    let attempts = 0;
    const maxAttempts = game.state.turnOrder!.length;
    const turnDirection = updates['state.turnDirection'] !== undefined ? updates['state.turnDirection'] : game.state.turnDirection!;

    const eliminatedPlayers = { ...game.state.eliminatedPlayers, ...(updates['state.eliminatedPlayers'] || {}) };
    const survivors = { ...game.state.survivors, ...(updates['state.survivors'] || {}) };


    do {
        nextPlayerIndex = (nextPlayerIndex + turnDirection + maxAttempts) % maxAttempts;
        nextPlayerId = game.state.turnOrder![nextPlayerIndex];
        attempts++;
    } while ((eliminatedPlayers[nextPlayerId] || survivors?.[nextPlayerId]) && attempts < maxAttempts * 2);

    if (attempts >= maxAttempts * 2) {
        // Everyone is out, end the game
        updates['state.status'] = 'finished';
        updates['state.actionLog'] = arrayUnion("All players have been eliminated or have survived. The game is over.");
        updates['state.statsRecorded'] = false;
    } else {
        updates['state.currentPlayerIndex'] = nextPlayerIndex;
        handleHordeRoll(game, updates);
    }
}


export function handleHordeRoll(game: Game, updates: any) {
    if (game.expansion !== 'zombie-edition' || game.state.status !== 'playing') {
        return;
    }
    
    const state = game.state as KillerEscapeGameState;

    // Use the deck from updates if it exists, otherwise from the current game state
    const currentDeck = updates['state.deck'] || state.deck || [];
    
    const zombieCap = (state.initialPlayerCount || game.players.length) * 2;
    const currentZombieCount = currentDeck.filter((c: CardDefinition) => c.name === 'Zombie').length;
    
    if (currentZombieCount >= zombieCap) {
        updates['state.actionLog'] = arrayUnion("The horde is at its maximum size! No new zombies will be added for now.");
        return; // Stop rolling if cap is reached
    }

    const modifier = state.zombieRollModifier || 0;
    const roll = Math.floor(Math.random() * 6) + 1;
    const rollNeeded = 1 + modifier;

    if (roll <= rollNeeded) {
        // Add a zombie
        const zombieCard = allKillerEscapeCards.find(c => c.name === 'Zombie')!;
        const newZombie = { ...zombieCard, id: `Zombie-Horde-${Date.now()}` };
        
        const newDeck = [...currentDeck, newZombie];
        
        updates['state.deck'] = newDeck.sort(() => Math.random() - 0.5); // Shuffle
        updates['state.zombieRollModifier'] = 0;
        updates['state.actionLog'] = arrayUnion(`Horde roll was ${roll} (needed ${rollNeeded} or less). The horde grows! A zombie has been added to the deck.`);
    } else {
        // Increase modifier
        updates['state.zombieRollModifier'] = modifier + 1;
        updates['state.actionLog'] = arrayUnion(`Horde roll was ${roll} (needed ${rollNeeded} or less). The horde grows closer... (+1 to next zombie roll).`);
    }
}
