
'use client';

import { CardDefinition } from './cards';
import { Game, Player } from './types';

type BotActionChoice = {
  type: 'PLAY_CARD' | 'DRAW_CARD';
  cardName?: string;
  options: any;
  priority: number; // 0 (lowest) to 10 (highest)
};

export function getBotAction(bot: Player, game: Game, hand: CardDefinition[]): BotActionChoice {
    const possibleActions = generatePossibleActions(bot, game, hand);
    
    if (!possibleActions || possibleActions.length === 0) {
        return { type: 'DRAW_CARD', options: {}, priority: 0 };
    }

    // Choose the action with the highest priority
    const bestAction = possibleActions.sort((a, b) => b.priority - a.priority)[0];
    
    return bestAction;
}

function generatePossibleActions(bot: Player, game: Game, hand: CardDefinition[]): BotActionChoice[] {
    let actions: BotActionChoice[] = [];

    // Always possible to draw a card (lowest priority)
    const defenseCard = getDefenseCardForMode(hand, game.expansion === 'zombie-edition');
    const drawPriority = defenseCard ? 1.5 : 0; // Slightly prefer drawing if holding a defense card, but still low.
    actions.push({ type: 'DRAW_CARD', options: {}, priority: drawPriority });

    for (const card of hand) {
        let action: BotActionChoice | null = null;
        try {
            if (!isCardPlayable(card, hand, bot, game)) {
                continue;
            }

            // --- WIN CONDITION (Highest Priority) ---
            if (card.special?.startsWith('key-')) {
                const keyPair = getSkeletonKeyPairFor(card, hand);
                if (keyPair) {
                    action = {
                        type: 'PLAY_CARD',
                        cardName: 'Skeleton Key',
                        options: { cardName1: keyPair[0].name, cardName2: keyPair[1].name },
                        priority: 10,
                    };
                }
            }
            // --- GOAL CONTRIBUTION (High Priority) ---
            else if (card.type === 'Goal') {
                const goalName = card.name.split(' - Part ')[0];
                const completion = game.state.completedGoals?.[goalName]?.length || 0;
                action = {
                    type: 'PLAY_CARD',
                    cardName: card.name,
                    options: {},
                    priority: 6 + completion / 6, // Priority from 6 to ~7
                };
            }
            // --- TACTICAL PLAYS (Medium-High Priority) ---
            else if (card.name === 'Search the Dead') {
                const targetCorpseId = selectCorpse(game, 'most_cards');
                if (targetCorpseId) {
                    const flashlight = hand.find(c => c.name.includes('Flashlight'));
                    if (flashlight) {
                        const corpse = (game.state.eliminatedPlayers as any)[targetCorpseId];
                        const bestCardToTake = findBestCardInHand(corpse.hand, game.expansion === 'zombie-edition', hand);
                        if (bestCardToTake) { // Only generate this action if a valid card is found
                            action = {
                                type: 'PLAY_CARD',
                                cardName: card.name,
                                options: { targetPlayerId: targetCorpseId, useFlashlight: true, cardToTake: bestCardToTake.name },
                                priority: 5,
                            };
                        }
                    } 
                    if (!action) { // Fallback if no flashlight or no good card to take
                        action = {
                            type: 'PLAY_CARD',
                            cardName: card.name,
                            options: { targetPlayerId: targetCorpseId, useFlashlight: false },
                            priority: 4,
                        };
                    }
                }
            }
            else if (card.name === 'Steal' || card.name === 'You go first!') {
                const targetPlayerId = selectTargetPlayer(bot.id, game, card.name);
                if (targetPlayerId) {
                    action = {
                        type: 'PLAY_CARD',
                        cardName: card.name,
                        options: { targetPlayerId },
                        priority: 4,
                    };
                }
            }
            else if (card.name.includes('Flashlight')) {
                const peekableCorpses = Object.entries(game.state.eliminatedPlayers || {}).filter(([_, p]:[string, any]) => p.hand?.length > 0);
                if (peekableCorpses.length > 0) {
                    const targetCorpseId = selectCorpse(game, 'most_cards');
                    if (targetCorpseId) {
                        action = {
                            type: 'PLAY_CARD',
                            cardName: card.name,
                            options: { peekChoice: 'corpse', targetPlayerId: targetCorpseId },
                            priority: 3,
                        };
                    }
                } else {
                    action = {
                        type: 'PLAY_CARD',
                        cardName: card.name,
                        options: { peekChoice: 'deck' },
                        priority: 2,
                    };
                }
            }
            // --- SURVIVAL PLAYS (Low-Medium Priority) ---
            else if (card.name === 'Hide' || card.name === 'Run') {
                action = {
                    type: 'PLAY_CARD',
                    cardName: card.name,
                    options: {},
                    priority: 1,
                };
            }
            
            if (action) {
                // Final validation: if an action requires a target, but we failed to find one, discard this action.
                const requiresTarget = ['Steal', 'You go first!'].includes(card.name);
                const requiresCorpse = card.name === 'Search the Dead';
                if ((requiresTarget || requiresCorpse) && !action.options.targetPlayerId) {
                     console.warn(`Bot wanted to play ${card.name} but couldn't find a valid target. Skipping action.`);
                } else if (!actions.some(a => a.cardName === action!.cardName)) {
                    actions.push(action);
                }
            }
        } catch (error) {
            console.warn(`Bot error evaluating card ${card.name}:`, error);
            // Don't add a broken action to the list.
            continue;
        }
    }
    
    return actions;
}

function findBestCardInHand(targetHand: CardDefinition[] | undefined, isZombieEdition: boolean, botOwnHand: CardDefinition[]): CardDefinition | null {
    if (!targetHand || targetHand.length === 0) return null;

    const botHasDefense = !!getDefenseCardForMode(botOwnHand, isZombieEdition);

    const getPriority = (card: CardDefinition): number => {
        const isDefense = card.special === 'defense-zombie' || card.special === 'defense';
        if (isDefense) {
            // High priority if bot needs defense, very low if it already has one.
            return botHasDefense ? 0.1 : 3;
        }
        if (card.special?.startsWith('key-')) {
            return 2;
        }
        if (['Flashlight', 'Strong Flashlight', 'Steal'].includes(card.name)) {
            return 1;
        }
        return 0.5; // Goal cards etc. are lowest priority to steal
    };
    
    const sortedCards = [...targetHand].sort((a, b) => getPriority(b) - getPriority(a));

    if (sortedCards.length > 0) {
        // If the top priority card is a defense card the bot already has, check if there's another option.
        const topCard = sortedCards[0];
        const isTopCardDefense = topCard.special === 'defense-zombie' || topCard.special === 'defense';

        if (botHasDefense && isTopCardDefense && sortedCards.length > 1 && getPriority(sortedCards[1]) > 0) {
            return sortedCards[1]; // Return the second-best card if it has any value
        }
        return topCard; // Return the best card
    }
    
    return null; 
}


function isCardPlayable(card: CardDefinition, hand: CardDefinition[], bot: Player, game: Game): boolean {
    const getActivePlayerCount = () => {
        return game.players.filter(p => !game.state.eliminatedPlayers?.[p.id] && !game.state.survivors?.[p.id]).length;
    };
    
    switch (card.name) {
        case 'Trap':
        case 'Killer':
        case 'Zombie':
        case 'Zombie Survivor':
            return false;

        case 'Search the Dead':
            // Can only play if there's a corpse with cards
            return Object.values(game.state.eliminatedPlayers || {}).some((p: any) => p.hand?.length > 0);

        case 'Steal':
            // Can only play if there's another active player with cards
            return game.players.some(p => 
                p.id !== bot.id && 
                !game.state.eliminatedPlayers?.[p.id] &&
                !game.state.survivors?.[p.id] &&
                (game.state.playerHands?.[p.id]?.length || 0) > 0
            );

        case 'You go first!':
            return game.players.some(p => p.id !== bot.id && !game.state.eliminatedPlayers?.[p.id] && !game.state.survivors?.[p.id]);

        default:
            if (card.special?.startsWith('key-')) {
                // Key is only playable if there's at least one other active player.
                // This prevents the bot from getting stuck in a 1-player endgame.
                return !!getSkeletonKeyPairFor(card, hand) && getActivePlayerCount() > 1;
            }
            return card.playable;
    }
}


function selectTargetPlayer(botId: string, game: Game, cardName: string): string | undefined {
    let activePlayers = game.players
        .filter(p => 
            p.id !== botId && 
            !game.state.eliminatedPlayers?.[p.id] &&
            !game.state.survivors?.[p.id]
        );
    
    if (cardName === 'Steal') {
        // For 'Steal', only target players with cards.
        activePlayers = activePlayers.filter(p => (game.state.playerHands?.[p.id]?.length || 0) > 0);
    }
    
    if (activePlayers.length === 0) return undefined;
    
    // Logic for both 'Steal' and 'You go first!': find player with the most cards.
    const playersWithHandSize = activePlayers.map(p => ({
        ...p,
        handSize: game.state.playerHands?.[p.id]?.length || 0,
    }));
    
    playersWithHandSize.sort((a, b) => b.handSize - a.handSize);

    return playersWithHandSize[0].id;
}


function selectCorpse(game: Game, strategy: 'most_cards' | 'random'): string | undefined {
    const corpses = Object.entries(game.state.eliminatedPlayers || {}).filter(([_, p]:[string, any]) => p.hand?.length > 0);

    if (corpses.length === 0) return undefined;

    if (strategy === 'most_cards') {
        let maxCards = -1;
        let targetId: string | undefined = undefined;
        for (const [playerId, pData] of corpses) {
            const handSize = (pData as any).hand.length;
            if (handSize > maxCards) {
                maxCards = handSize;
                targetId = playerId;
            }
        }
        return targetId;
    }
    
    // Default or 'random' strategy
    return corpses[Math.floor(Math.random() * corpses.length)][0];
}


function getSkeletonKeyPairFor(card: CardDefinition, hand: CardDefinition[]): [CardDefinition, CardDefinition] | null {
    if (!card.special?.startsWith('key-')) return null;

    const keyNum = card.special.split('-')[1];
    const part = card.special.split('-')[2];
    const counterpart = part === 'A' ? 'B' : 'A';
    const counterpartSpecial = `key-${keyNum}-${counterpart}`;
    
    const counterpartCard = hand.find(k => k.special === counterpartSpecial);

    if (counterpartCard) {
        return [card, counterpartCard];
    }
    return null;
}

function getDefenseCardForMode(hand: CardDefinition[], isZombieEdition: boolean): CardDefinition | null {
    const defenseSpecial = isZombieEdition ? 'defense-zombie' : 'defense';
    return hand.find(c => c.special === defenseSpecial) || null;
}
    

    

    

