
'use client';

import { 
    doc,
    addDoc,
    runTransaction, 
    collection,
    arrayUnion,
    updateDoc,
    FieldValue,
    deleteField,
    getDoc,
    writeBatch,
    Firestore,
    Transaction,
    query,
    where,
    getDocs,
    deleteDoc,
    increment,
    serverTimestamp,
} from 'firebase/firestore';
import { Game, Player, CardDefinition, KillerEscapeGameState } from './types';
import { advanceTurn, checkEndGame, handleHordeRoll } from './game-logic-client';
import { allKillerEscapeCards } from './cards';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getBotAction, BotActionChoice } from '@/lib/bot-logic';

export function createGame(db: Firestore, creator: { id: string; name: string }, expectedPlayers: number = 8): Promise<string> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    const gameData: Omit<Game, 'id'> = {
        type: 'killer-escape',
        creator: creator,
        players: [],
        expectedPlayers: expectedPlayers,
        state: { status: 'waiting' },
        createdAt: new Date().toISOString(),
        expansion: null,
    };
    const gamesCollection = collection(db, 'games');

    return addDoc(gamesCollection, gameData)
        .then(gameRef => gameRef.id)
        .catch(error => {
            if (error.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: gamesCollection.path,
                    operation: 'create',
                    requestResourceData: gameData,
                });
                errorEmitter.emit('permission-error', permissionError);
            }
            throw error;
        });
}


export function joinSeat(db: Firestore, gameId: string, player: Player, seatNumber: number): Promise<void> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    const gameRef = doc(db, 'games', gameId);
    
    return runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) {
            throw new Error('Game not found.');
        }
        const gameData = gameDoc.data() as Game;
        const players = gameData.players || [];

        if (players.some((p: any) => p && p.seat === seatNumber)) {
            throw new Error('Seat is already taken.');
        }

        const playerExists = players.some((p: any) => p && p.id === player.id);
        if (!playerExists && players.length >= gameData.expectedPlayers) {
            throw new Error('Game is full.');
        }

        const updatedPlayers = players.filter((p: any) => p && p.id !== player.id);
        updatedPlayers.push({ ...player, seat: seatNumber });
        
        transaction.update(gameRef, { players: updatedPlayers });
    }).catch(error => {
        if (error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { players: `arrayUnion(${JSON.stringify(player)})` },
            });
            errorEmitter.emit('permission-error', permissionError);
        }
         throw error;
    });
}


export function addBot(db: Firestore, gameId: string, creatorId: string, seatNumber?: number): Promise<void> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    const gameRef = doc(db, 'games', gameId);
    let newBotForErrorContext: Player | null = null;
    const transactionFunction = async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");
        
        const game = gameDoc.data() as Game;
        if (game.creator.id !== creatorId) throw new Error("Only the game creator can add bots.");
        
        const players = game.players || [];
        if (players.length >= game.expectedPlayers) throw new Error("The game is already full.");

        const occupiedSeats = new Set(players.map(p => p.seat));
        let finalSeatNumber: number;

        if (seatNumber !== undefined && !occupiedSeats.has(seatNumber)) {
            finalSeatNumber = seatNumber;
        } else {
             let availableSeat = -1;
            for (let i = 0; i < game.expectedPlayers; i++) {
                if (!occupiedSeats.has(i)) {
                    availableSeat = i;
                    break;
                }
            }
            if (availableSeat === -1) throw new Error("No available seats found.");
            finalSeatNumber = availableSeat;
        }
        
        const existingNames = new Set(players.map(p => p.name));

        const botNamesKE = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi'];
        let botName: string;
        
        const availableName = botNamesKE.find(n => !existingNames.has(`Survivor ${n}`));
        if (availableName) {
            botName = `Survivor ${availableName}`;
        } else {
            let randomNum = Math.floor(Math.random() * 1000);
            let potentialName = `Survivor ${randomNum}`;
            while (existingNames.has(potentialName)) {
                randomNum = Math.floor(Math.random() * 1000);
                potentialName = `Survivor ${randomNum}`;
            }
            botName = potentialName;
        }

        const newBot: Player = {
            id: `bot_${Math.random().toString(36).substring(2, 9)}`,
            name: botName,
            seat: finalSeatNumber,
        };
        newBotForErrorContext = newBot;
        
        transaction.update(gameRef, { players: arrayUnion(newBot) });
    };

    return runTransaction(db, transactionFunction).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { players: `arrayUnion(${JSON.stringify(newBotForErrorContext)})` },
            });
            errorEmitter.emit('permission-error', permissionError);
        }
         throw error;
    });
}

export function startGame(db: Firestore, gameId: string, creatorId: string): Promise<void> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    return startKillerEscapeGame(db, gameId, creatorId);
}

async function startKillerEscapeGame(db: Firestore, gameId: string, creatorId: string): Promise<void> {
    const gameRef = doc(db, 'games', gameId);
    let transactionUpdates: any = {};
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");
        
        let game = gameDoc.data() as Game;
        if (game.creator.id !== creatorId) throw new Error("Only the game creator can start the game.");
        if (game.players.length < 4) throw new Error("A minimum of 4 players is required to start the game.");
        if (game.state.status !== 'waiting') throw new Error("Game has already started or is finished.");

        const isZombieEdition = game.expansion === 'zombie-edition';

        let baseDeckSource = allKillerEscapeCards;

        if (isZombieEdition) {
            // In zombie edition, we don't use the regular killer card.
            baseDeckSource = allKillerEscapeCards.filter(card => card.special !== 'killer');
        } else {
             // In base game, we don't use the zombie cards.
            baseDeckSource = allKillerEscapeCards.filter(card => !card.special?.includes('zombie'));
        }


        const baseDeck = baseDeckSource.flatMap((cardDef, index) => {
            if (cardDef.quantity === 1) {
                return [{ ...cardDef, id: `${cardDef.name.replace(/\s+/g, '-')}-${index}` }];
            }
            return Array.from({ length: cardDef.quantity }, (_, i) => ({
                ...cardDef,
                id: `${cardDef.name.replace(/\s+/g, '-')}-${index}-${i}`
            }));
        });
        
        let deckForDealing = shuffle(baseDeck);

        const shuffledLobbyPlayers = shuffle(game.players);
        const turnOrder = shuffledLobbyPlayers.map(p => p.id);
        const playersWithSeats = shuffledLobbyPlayers.map((p, i) => ({ ...p, seat: i }));

        const playerHands: { [playerId: string]: any[] } = {};
        playersWithSeats.forEach(p => {
            playerHands[p.id] = [];
        });

        for(let i = 0; i < 3; i++) {
            for (const player of playersWithSeats) {
                if (deckForDealing.length > 0) {
                    playerHands[player.id].push(deckForDealing.pop()!);
                }
            }
        }
        
        const traps = Array(5).fill(null).map((_,i) => ({...allKillerEscapeCards.find(c => c.name === 'Trap')!, id: `Trap-${i}`}));
        
        let threatCards: CardDefinition[];
        if (isZombieEdition) {
            const zombieCard = allKillerEscapeCards.find(c => c.name === 'Zombie')!;
            threatCards = Array(playersWithSeats.length).fill(null).map((_, i) => ({ ...zombieCard, id: `Zombie-${i}` }));
        } else {
            const killerCard = allKillerEscapeCards.find(c => c.name === 'Killer')!;
            threatCards = Array(playersWithSeats.length).fill(null).map((_, i) => ({ ...killerCard, id: `Killer-${i}` }));
        }

        let finalDeck = shuffle([...deckForDealing, ...traps, ...threatCards]);
        
        transactionUpdates.players = playersWithSeats;
        const state: KillerEscapeGameState = {
            status: 'playing',
            deck: finalDeck,
            playerHands,
            discardPile: [],
            turnOrder,
            currentPlayerIndex: 0,
            turnDirection: 1,
            completedGoals: {},
            eliminatedPlayers: {},
            survivors: {},
            actionLog: ['The game has started! Seats and turn order have been randomized.'],
            initialPlayerCount: playersWithSeats.length,
            statsRecorded: false,
        };

        if(isZombieEdition) {
            state.zombieRollModifier = 0;
        }

        transactionUpdates.state = state;
        
        transaction.update(gameRef, transactionUpdates);

    }).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: transactionUpdates
            });
            errorEmitter.emit('permission-error', permissionError);
        }
         throw error;
    });
}


export async function drawCard(db: Firestore, gameId: string, userId: string): Promise<{ message: string, turnEnded: boolean }> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    const gameRef = doc(db, 'games', gameId);
    let resultMessage = '';
    let transactionUpdates: any = {};
    let turnEnded = false;
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");
        
        let game = gameDoc.data() as Game;
        
        const drawResult = executeDrawCard(game, userId, transactionUpdates);
        resultMessage = drawResult.message;
        turnEnded = drawResult.turnEnded;
        
        transaction.update(gameRef, transactionUpdates);

    }).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: transactionUpdates
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        throw error;
    });

    return { message: resultMessage, turnEnded };
}

export async function playCard(db: Firestore, gameId: string, userId:string, cardName: string, options: any = {}): Promise<{ peekedData: { title: string, cards: CardDefinition[] } | null; message?: string; turnEnded?: boolean; }> {
    if (!db) {
        throw new Error("Firestore instance is not available.");
    }
    const gameRef = doc(db, 'games', gameId);
    let peekedData: { title: string, cards: CardDefinition[] } | null = null;
    let resultMessage: string | undefined;
    let turnEnded: boolean | undefined;
    let transactionUpdates: any = {};
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");
        
        let game = gameDoc.data() as Game;
        
        const playResult = executePlayCard(game, userId, cardName, options, transactionUpdates);
        peekedData = playResult.peekedData;
        resultMessage = playResult.message;
        turnEnded = playResult.turnEnded;
        
        transaction.update(gameRef, transactionUpdates);

    }).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: transactionUpdates
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        throw error;
    });

    return { peekedData, message: resultMessage, turnEnded };
}

// Internal function to execute drawing a card logic
function executeDrawCard(game: Game, userId: string, transactionUpdates: any): { game: Game, message: string, turnEnded: boolean } {
    const actingPlayer = game.players.find(p => p.id === userId);
    if (!actingPlayer) throw new Error("Player not found.");
    
    const state = game.state as KillerEscapeGameState;
    const currentPlayerId = state.turnOrder![state.currentPlayerIndex!];
    if (currentPlayerId !== userId && state.status === 'playing') {
         if(!userId.startsWith('bot_')) { // Allow bot actions even if it's not their turn if something went wrong
            throw new Error("It's not your turn.");
         }
    }
    

    let message = "";

    if (!state.deck || state.deck.length === 0) {
        transactionUpdates['state.status'] = 'finished';
        transactionUpdates['state.actionLog'] = arrayUnion("The deck is empty! The game is over.");
        transactionUpdates['state.statsRecorded'] = false;
        transactionUpdates['deletedAt'] = Date.now() + 2 * 60 * 1000; // 2 minutes
        return { game: applyUpdates(game, transactionUpdates), message: "The deck is empty! The game is over.", turnEnded: true };
    }

    const deck: CardDefinition[] = [...state.deck];
    const drawnCard = deck.pop()!;
    let playerHand: CardDefinition[] = state.playerHands![userId] || [];
    
    let actionLogEntries: string[] = [];
    
    const isThreat = drawnCard.special === 'killer' || drawnCard.special === 'zombie';
    const isZombieEdition = game.expansion === 'zombie-edition';

    if (drawnCard.name === 'Trap') {
        actionLogEntries.push(`${actingPlayer.name} drew a Trap and takes 2 more cards.`);
        message = `You drew a Trap! You draw 2 more cards.`;

        const newCards = deck.splice(deck.length - Math.min(2, deck.length), Math.min(2, deck.length));
        
        playerHand.push(...newCards.filter(c => c.special !== 'trap' && c.special !== 'killer' && c.special !== 'zombie'));

        const hazards = newCards.filter(c => c.special === 'trap' || c.special === 'killer' || c.special === 'zombie');
        deck.push(drawnCard, ...hazards);
        
        transactionUpdates['state.deck'] = shuffle(deck);
        transactionUpdates[`state.playerHands.${userId}`] = playerHand;

    } else if (isThreat) {
        const shotgunIndex = playerHand.findIndex(c => c.special === 'defense-zombie');
        const heavyObjectIndex = playerHand.findIndex(c => c.special === 'defense');

        let defenseUsed: { index: number; card: CardDefinition; type: 'shotgun' | 'object' } | null = null;

        if (drawnCard.special === 'zombie' && isZombieEdition) {
            if (shotgunIndex !== -1) {
                defenseUsed = { index: shotgunIndex, card: playerHand[shotgunIndex], type: 'shotgun' };
            } else if (heavyObjectIndex !== -1) {
                defenseUsed = { index: heavyObjectIndex, card: playerHand[heavyObjectIndex], type: 'object' };
            }
        } else if (drawnCard.special === 'killer' && !isZombieEdition) {
            if (heavyObjectIndex !== -1) {
                defenseUsed = { index: heavyObjectIndex, card: playerHand[heavyObjectIndex], type: 'object' };
            }
        } else if(isZombieEdition && heavyObjectIndex !== -1) {
            // This covers the case where a player in zombie edition draws a "Killer" card (which shouldn't happen)
            // or a "Zombie Survivor" and only has a heavy object.
            defenseUsed = { index: heavyObjectIndex, card: playerHand[heavyObjectIndex], type: 'object' };
        }


        if (defenseUsed) {
            playerHand.splice(defenseUsed.index, 1);
            
            if (defenseUsed.type === 'shotgun') {
                 // Shotgun discards both cards
                transactionUpdates['state.discardPile'] = arrayUnion(defenseUsed.card, drawnCard);
                 actionLogEntries.push(`${actingPlayer.name} drew a ${drawnCard.name}, but blasted it with a ${defenseUsed.card.name}!`);
                 message = `You drew a ${drawnCard.name}, but defended yourself with a ${defenseUsed.card.name}!`;
            } else { // Heavy Object
                deck.push(drawnCard);
                transactionUpdates['state.discardPile'] = arrayUnion(defenseUsed.card);
                actionLogEntries.push(`${actingPlayer.name} drew a ${drawnCard.name}, but was saved by a ${defenseUsed.card.name}! The threat returns to the deck.`);
                message = `You drew a ${drawnCard.name}, but defended yourself with a ${defenseUsed.card.name}!`;
            }
            transactionUpdates['state.deck'] = shuffle(deck);
            transactionUpdates[`state.playerHands.${userId}`] = playerHand;

        } else {
            let eliminationMethod = `Caught by a ${drawnCard.name}`;
            if (isZombieEdition && drawnCard.special === 'zombie') {
                eliminationMethod = 'They were bitten and turned into a Zombie!';
            }
            
            transactionUpdates[`state.eliminatedPlayers.${userId}`] = { ...actingPlayer, hand: playerHand, method: eliminationMethod };
            transactionUpdates[`state.playerHands.${userId}`] = deleteField();
            
            if (drawnCard.special === 'zombie' && isZombieEdition) {
                const zombieSurvivorCard = allKillerEscapeCards.find(c => c.name === 'Zombie Survivor')!;
                deck.push(drawnCard, { ...zombieSurvivorCard, id: `Zombie-Survivor-${userId}` });
                transactionUpdates['state.deck'] = shuffle(deck);
                actionLogEntries.push(`${actingPlayer.name} was bitten and turned into a zombie! A Zombie Survivor card was added to the deck.`);
                message = `You have been caught by a ${drawnCard.name} and eliminated!`;
            } else {
                // If it's not zombie edition, or it's a standard killer, it just goes back in the deck without creating a survivor
                deck.push(drawnCard);
                transactionUpdates['state.deck'] = shuffle(deck);
                actionLogEntries.push(`${actingPlayer.name} was caught by a ${drawnCard.name} and has been eliminated.`);
                message = `You have been caught by a ${drawnCard.name} and eliminated!`;
            }
        }
    } else {
        playerHand.push(drawnCard);
        transactionUpdates['state.deck'] = deck;
        transactionUpdates[`state.playerHands.${userId}`] = playerHand;
        actionLogEntries.push(`${actingPlayer.name} drew a card and ended their turn.`);
        message = `You drew a "${drawnCard.name}".`;
    }
    
    if (actionLogEntries.length > 0) {
        transactionUpdates['state.actionLog'] = arrayUnion(...actionLogEntries);
    }
    
    let tempGame = applyUpdates(game, transactionUpdates);

    if (checkEndGame(tempGame, transactionUpdates)) {
        transactionUpdates['deletedAt'] = Date.now() + 2 * 60 * 1000; // 2 minutes
    } else {
        advanceTurn(tempGame, transactionUpdates);
    }
    
    return { game: applyUpdates(game, transactionUpdates), message, turnEnded: true };
}


function executePlayCard(game: Game, userId: string, cardName: string, options: any, transactionUpdates: any): { game: Game, peekedData: { title: string, cards: CardDefinition[] } | null, turnEnded: boolean, message?: string } {
    const actingPlayer = game.players.find(p => p.id === userId)!;
    const state = game.state as KillerEscapeGameState;
    if (state.status === 'playing') {
        const currentPlayerId = state.turnOrder![state.currentPlayerIndex!];
        if (currentPlayerId !== userId) {
            if(!userId.startsWith('bot_')) { // Allow bot actions even if it's not their turn if something went wrong
                throw new Error("It's not your turn.");
            }
        }
    }
    
    let playerHand = [...(state.playerHands![userId] || [])];
    const cardsToDiscard: CardDefinition[] = [];
    
    let turnEnded = false;
    let actionLogEntries: string[] = [];
    let peekedData: { title: string, cards: CardDefinition[] } | null = null;
    let resultMessage: string | undefined;

    if (cardName === 'Skeleton Key') {
        const keyPart1Index = playerHand.findIndex(c => c.name === options.cardName1);
        const keyPart2Index = playerHand.findIndex(c => c.name === options.cardName2);

        if (keyPart1Index === -1 || keyPart2Index === -1) throw new Error("You don't have both skeleton key parts.");
        
        const keyPart1 = playerHand[keyPart1Index];
        const keyPart2 = playerHand[keyPart2Index];
        
        playerHand.splice(Math.max(keyPart1Index, keyPart2Index), 1);
        playerHand.splice(Math.min(keyPart1Index, keyPart2Index), 1);

        cardsToDiscard.push(keyPart1, keyPart2);
        
        transactionUpdates[`state.survivors.${userId}`] = { id: userId, name: actingPlayer.name, method: 'Escaped with Skeleton Key' };
        actionLogEntries.push(`${actingPlayer.name} played a Skeleton Key and escaped! Their hand is shuffled back into the deck.`);
        transactionUpdates['state.deck'] = shuffle([...state.deck!, ...playerHand]);
        playerHand = [];
        turnEnded = true;
    } else {
        const cardIndex = playerHand.findIndex(c => c.name === cardName);
        if (cardIndex === -1) throw new Error(`You don't have the card: ${cardName}.`);
        
        const cardToPlay = playerHand.splice(cardIndex, 1)[0];
        
        if (cardToPlay.type === 'Goal') {
            const goalName = cardToPlay.name.split(' - Part ')[0];
            const completedCount = state.completedGoals?.[goalName]?.length || 0;
            
            if (completedCount === 5) {
                 let sacrificeMethod = `Sacrificed to complete ${goalName}`;
                 if (goalName === 'Repair a Car') sacrificeMethod = 'Sacrificed to repair the car for others to escape';
                 if (goalName === 'Build a Trap') {
                    sacrificeMethod = game.expansion === 'zombie-edition'
                        ? 'Sacrificed to build the trap to catch the zombie horde'
                        : 'Sacrificed to build the trap to catch the killer';
                 }
                 if (goalName === 'Repair a Radio') sacrificeMethod = 'Sacrificed to repair the radio to call for help';

                 transactionUpdates[`state.eliminatedPlayers.${userId}`] = { ...actingPlayer, hand: playerHand, method: sacrificeMethod };
                 playerHand = [];
                 actionLogEntries.push(`${actingPlayer.name} played the final piece of ${goalName} and was sacrificed to complete it!`);
                 turnEnded = true;
            } else {
                actionLogEntries.push(`${actingPlayer.name} contributed to the '${goalName}' goal.`);
                const drawResult = executeDrawCard(game, userId, transactionUpdates);
                actionLogEntries.push(...(transactionUpdates['state.actionLog']?._elements || [])); // Capture logs from draw
                resultMessage = drawResult.message;
                turnEnded = true;
            }

            const currentGoals = state.completedGoals?.[goalName] || [];
            transactionUpdates[`state.completedGoals.${goalName}`] = [...currentGoals, cardToPlay.name];
            cardsToDiscard.push(cardToPlay);

        } else {
             cardsToDiscard.push(cardToPlay);

            if (cardToPlay.name === 'Run') {
                actionLogEntries.push(`${actingPlayer.name} played Run, reversing the turn order.`);
                transactionUpdates['state.turnDirection'] = (state.turnDirection || 1) * -1;
                turnEnded = true;
            } else if (cardToPlay.name === 'Hide') {
                actionLogEntries.push(`${actingPlayer.name} played Hide and will not draw a card this turn.`);
                turnEnded = true;
            } else if (cardToPlay.name === 'Flashlight' || cardToPlay.name === 'Strong Flashlight') {
                turnEnded = true;
                actionLogEntries.push(`${actingPlayer.name} played ${cardToPlay.name}.`);
                if(options.peekChoice === 'deck') {
                    const count = cardToPlay.name === 'Strong Flashlight' ? 5 : 3;
                    peekedData = {
                        title: `Top ${count} cards of the deck`,
                        cards: state.deck!.slice(-count).reverse()
                    };
                    actionLogEntries.push(`${actingPlayer.name} used ${cardToPlay.name} to peek at the top of the deck.`);
                } else if (options.peekChoice === 'corpse') {
                    const targetCorpse = state.eliminatedPlayers![options.targetPlayerId];
                    if (!targetCorpse || !targetCorpse.hand) throw new Error("Corpse not found or has no cards.");
                    peekedData = {
                        title: `Cards from ${targetCorpse.name}'s hand`,
                        cards: targetCorpse.hand
                    };
                     actionLogEntries.push(`${actingPlayer.name} used ${cardToPlay.name} to peek at ${targetCorpse.name}'s hand.`);
                }
            } else if (cardToPlay.name === 'Search the Dead') {
                 turnEnded = true;
                 actionLogEntries.push(`${actingPlayer.name} played Search the Dead.`);
                if (!options.targetPlayerId) throw new Error("No corpse selected.");
                const targetCorpse = state.eliminatedPlayers![options.targetPlayerId];
                if (!targetCorpse || !targetCorpse.hand || targetCorpse.hand.length === 0) {
                     actionLogEntries.push(`${actingPlayer.name} searched ${targetCorpse?.name || 'a corpse'}, but found nothing.`);
                } else {
                    let corpseHand = [...targetCorpse.hand];
                    let stolenCard: CardDefinition;

                    if (options.useFlashlight && options.cardToTake) {
                         const cardToTakeIndex = corpseHand.findIndex(c => c.name === options.cardToTake);
                         if (cardToTakeIndex === -1) throw new Error("Chosen card not found in corpse's hand.");
                         stolenCard = corpseHand.splice(cardToTakeIndex, 1)[0];
                         
                         const flashlightIndex = playerHand.findIndex(c => c.name.includes('Flashlight'));
                         if (flashlightIndex !== -1) {
                            const flashlightCard = playerHand.splice(flashlightIndex, 1)[0];
                            cardsToDiscard.push(flashlightCard);
                            actionLogEntries.push(`${actingPlayer.name} used a ${flashlightCard.name} on ${targetCorpse.name}'s corpse and took a ${stolenCard.name}.`);
                         } else {
                             actionLogEntries.push(`${actingPlayer.name} searched ${targetCorpse.name}'s corpse and took a ${stolenCard.name}.`);
                         }
                    } else {
                        stolenCard = corpseHand.splice(Math.floor(Math.random() * corpseHand.length), 1)[0];
                        actionLogEntries.push(`${actingPlayer.name} took a random card from ${targetCorpse.name}'s corpse.`);
                    }
                    
                    playerHand.push(stolenCard);
                    if (corpseHand.length > 0) {
                        transactionUpdates[`state.eliminatedPlayers.${options.targetPlayerId}.hand`] = corpseHand;
                    } else {
                        // Use deleteField to ensure listeners properly detect the hand is gone.
                        transactionUpdates[`state.eliminatedPlayers.${options.targetPlayerId}.hand`] = deleteField();
                    }
                }
            } else if (cardToPlay.name === 'You go first!') {
                if (!options.targetPlayerId) throw new Error("No target selected.");
                const targetPlayer = game.players.find(p => p.id === options.targetPlayerId);
                transactionUpdates.nextPlayerIdOverride = options.targetPlayerId;
                actionLogEntries.push(`${actingPlayer.name} played 'You go first!', making ${targetPlayer?.name} go next.`);
                turnEnded = true;
            } else if (cardToPlay.name === 'Steal') {
                turnEnded = true;
                if (!options.targetPlayerId) throw new Error("No target selected.");
                const targetPlayer = game.players.find(p => p.id === options.targetPlayerId);
                let targetHand = state.playerHands![options.targetPlayerId] || [];
                if (targetHand.length === 0) {
                     actionLogEntries.push(`${actingPlayer.name} tried to steal from ${targetPlayer?.name}, but their hand was empty.`);
                } else {
                    const stolenCard = targetHand.splice(Math.floor(Math.random() * targetHand.length), 1)[0];
                    playerHand.push(stolenCard);
                    transactionUpdates[`state.playerHands.${options.targetPlayerId}`] = targetHand;
                    actionLogEntries.push(`${actingPlayer.name} played Steal and took a card from ${targetPlayer?.name}.`);
                }
            }
        }
    }

    if (playerHand.length > 0) {
        transactionUpdates[`state.playerHands.${userId}`] = playerHand;
    } else {
        transactionUpdates[`state.playerHands.${userId}`] = deleteField();
    }

    if (cardsToDiscard.length > 0) {
        transactionUpdates['state.discardPile'] = arrayUnion(...cardsToDiscard);
    }
    
    if(actionLogEntries.length > 0) {
        transactionUpdates['state.actionLog'] = arrayUnion(...actionLogEntries.filter(e => e));
    }

    const tempGame = applyUpdates(game, transactionUpdates);
    
    if (checkEndGame(tempGame, transactionUpdates)) {
        transactionUpdates['deletedAt'] = Date.now() + 2 * 60 * 1000;
    } else {
        if (turnEnded && !transactionUpdates.nextPlayerIdOverride) {
            advanceTurn(tempGame, transactionUpdates);
        } else if (turnEnded && transactionUpdates.nextPlayerIdOverride) {
            const overrideId = transactionUpdates.nextPlayerIdOverride;
            const nextPlayerIndex = tempGame.state.turnOrder!.findIndex(id => id === overrideId);
            if (nextPlayerIndex !== -1) {
                transactionUpdates['state.currentPlayerIndex'] = nextPlayerIndex;
                delete transactionUpdates.nextPlayerIdOverride;
                handleHordeRoll(tempGame, transactionUpdates);
            } else {
                delete transactionUpdates.nextPlayerIdOverride;
                advanceTurn(tempGame, transactionUpdates);
            }
        }
    }
    
    return { game: applyUpdates(game, transactionUpdates), peekedData, turnEnded, message: resultMessage };
}

export async function handleBotTurn(db: Firestore, gameId: string, botId: string): Promise<void> {
    if (!db) throw new Error("Firestore instance is not available.");
    const gameRef = doc(db, 'games', gameId);
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");

        let game = gameDoc.data() as Game;
        
        const state = game.state as KillerEscapeGameState;
        const currentPlayerId = state.turnOrder![state.currentPlayerIndex!];
        if (currentPlayerId !== botId || state.status !== 'playing') {
            return; // Not this bot's turn, or game not in play. Silently exit.
        }
        
        const botPlayer = game.players.find(p => p.id === botId)!;
        const botHand = state.playerHands?.[botId] || [];
        const action: BotActionChoice | null = getBotAction(botPlayer, game, botHand);
        
        const updates: any = {};
        
        // This is the ultimate failsafe. If any bot action fails for any reason
        // (e.g., a race condition or an unexpected card interaction), it will catch the error
        // and force the bot to draw a card, guaranteeing the game never gets stuck.
        try {
             if (!action) {
                // Failsafe if getBotAction returns nothing
                throw new Error("Bot failed to choose an action.");
            }
            if (action.type === 'PLAY_CARD' && action.cardName) {
                const playResult = executePlayCard(game, botId, action.cardName, action.options, updates);
                // Ensure a bot's turn always ends. If a card like Flashlight was played
                // which doesn't end the turn for a human, we must force the turn to end for a bot.
                if (!playResult.turnEnded) {
                    const tempGame = applyUpdates(game, updates);
                    if (!checkEndGame(tempGame, updates)) {
                        advanceTurn(tempGame, updates);
                    }
                }
            } else {
                // This covers the case where the action is DRAW_CARD.
                executeDrawCard(game, botId, updates);
            }
        } catch (error) {
            const actionName = action?.type === 'PLAY_CARD' ? action.cardName : 'DRAW_CARD';
            console.warn(`Bot action '${actionName}' for bot ${botId} failed. Reason: ${(error as Error).message}. Falling back to drawing a card.`);
            const fallbackUpdates: any = {};
            fallbackUpdates['state.actionLog'] = arrayUnion(`${botPlayer.name}'s plan failed. They draw a card instead.`);
            executeDrawCard(game, botId, fallbackUpdates);
            transaction.update(gameRef, fallbackUpdates);
            return; // Exit after applying fallback updates
        }
        
        if (Object.keys(updates).length > 0) {
            transaction.update(gameRef, updates);
        }
    }).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { botTurn: botId } 
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        console.error(`Transaction failed for bot turn ${botId}:`, error);
        throw error;
    });
}


export async function cleanupAbandonedGames(db: Firestore): Promise<void> {
    if (!db) return;

    const gamesRef = collection(db, 'games');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const completedQuery = query(gamesRef,
        where('deletedAt', '<', Date.now())
    );

    const waitingQuery = query(gamesRef, 
        where('state.status', '==', 'waiting')
    );

    try {
        const [completedSnapshot, waitingSnapshot] = await Promise.all([
            getDocs(completedQuery),
            getDocs(waitingQuery)
        ]);

        const batch = writeBatch(db);
        let count = 0;

        completedSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        waitingSnapshot.forEach(doc => {
            const game = doc.data();
            if (game.createdAt < twentyFourHoursAgo) {
                batch.delete(doc.ref);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
    } catch (error) {
        // No need to throw permission errors for cleanup
        console.error("Error during game cleanup:", error);
    }
}


export async function skipBotTurn(db: Firestore, gameId: string, botId: string): Promise<void> {
    if (!db) throw new Error("Firestore instance is not available.");
    const gameRef = doc(db, 'games', gameId);
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found.");

        let game = gameDoc.data() as Game;
        const state = game.state as KillerEscapeGameState;
        const currentPlayerId = state.turnOrder![state.currentPlayerIndex!];
        const botPlayer = game.players.find(p => p.id === botId)!;


        if (currentPlayerId !== botId || !botId.startsWith('bot_')) {
            throw new Error("It is not this bot's turn to be skipped.");
        }
        
        const updates: any = {};
        updates['state.actionLog'] = arrayUnion(`${botPlayer.name} was skipped by a player and forced to draw.`);
        executeDrawCard(game, botId, updates);
        
        if (Object.keys(updates).length > 0) {
            transaction.update(gameRef, updates);
        }
    }).catch(error => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { skippedBot: botId } 
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        throw error;
    });
}


function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex > 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

// Helper to apply transaction updates to a local game object for simulation
function applyUpdates(game: Game, updates: any): Game {
    const newGame = JSON.parse(JSON.stringify(game)); // Deep copy

    for (const key in updates) {
        const value = updates[key];
        const path = key.split('.');
        
        let current: any = newGame;
        for (let i = 0; i < path.length - 1; i++) {
            if (current[path[i]] === undefined || current[path[i]] === null) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        
        const finalKey = path[path.length - 1];

        if (value && typeof value === 'object' && value.constructor && (value.constructor.name === 'FieldValue' || value.constructor.name === 'S' || value.constructor.name === 'Pi')) {
             if (JSON.stringify(value).includes('_elements')) { // ArrayUnion
               const elementsToAdd = (value as any)._elements || [];
               if(!current[finalKey] || !Array.isArray(current[finalKey])) {
                   current[finalKey] = [];
               }
                current[finalKey].push(...elementsToAdd);
            }
             else { // Assume DeleteField
                delete current[finalKey];
             }
        } else if (value === null) {
            delete current[finalKey];
        }
        else {
            current[finalKey] = value;
        }
    }

    return newGame;
}

export async function recordGameStats(gameId: string, idToken: string): Promise<void> {
  try {
    const response = await fetch('/api/record-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ gameId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to record stats.');
    }
    // Success, no need to do anything further on the client.
  } catch (error) {
    console.error("Client-side error recording game stats:", error);
    // We don't re-throw here because failing to record stats
    // should not block the user's UI flow (e.g., seeing the results screen).
  }
}
