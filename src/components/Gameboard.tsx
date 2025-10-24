
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Game, Player } from '@/lib/types';
import { CardDefinition } from '@/lib/cards';
import { cn } from '@/lib/utils';
import { User, Bot, Crown, PartyPopper, Skull, Library, Layers, X, Timer, Hand, ChevronsUpDown } from 'lucide-react';
import GameCard from './GameCard';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { drawCard, playCard, handleBotTurn, skipBotTurn, recordGameStats } from '@/lib/game-actions';
import { useFirestore, useUser } from '@/firebase';
import CardLibraryDialog from '@/components/killer-escape/CardLibraryDialog';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';


interface GameboardProps {
    game: Game;
    currentUserId: string;
}

const PlayerStatus = ({ 
    player, 
    isCurrentTurn, 
    isEliminated, 
    isSurvivor, 
    isCreator, 
    handSize,
}: { 
    player: Player, 
    isCurrentTurn: boolean, 
    isEliminated: boolean, 
    isSurvivor: boolean, 
    isCreator: boolean, 
    handSize: number,
}) => {
    const isBot = player.id.startsWith('bot_');
    return (
        <div className={cn(
            "p-2 border rounded-lg flex flex-col items-center justify-center transition-all text-center relative",
            isCurrentTurn && !isEliminated && "ring-2 ring-primary shadow-lg",
            isEliminated ? "bg-destructive/20 opacity-50" : "bg-muted/50",
            isSurvivor && "bg-green-500/30 ring-2 ring-green-400"
        )}>
            {isCreator && !isBot && <Crown className="absolute -top-2 -right-2 w-4 h-4 text-yellow-400 fill-current" />}
            
            <div className="relative flex items-center justify-center w-full">
                 {isEliminated ? <Skull className="w-5 h-5 sm:w-6 sm:h-6 text-destructive-foreground" /> : (isBot ? <Bot className="w-5 h-5 sm:w-6 sm:h-6" /> : <User className="w-5 h-5 sm:w-6 sm:h-6" />)}
                 <div className={cn(
                    "flex items-center gap-1 text-xs font-bold absolute -right-1 -bottom-1",
                    isEliminated ? "text-destructive-foreground" : "text-foreground"
                )}>
                    <Layers className="w-3 h-3" />
                    <span>{handSize}</span>
                </div>
            </div>

            <span className="text-xs sm:text-sm font-semibold truncate mt-1 w-full">{player.name}</span>
            {isEliminated && <span className="text-xs font-bold text-destructive-foreground">ELIMINATED</span>}
            {isSurvivor && <span className="text-xs font-bold text-green-200">SURVIVED</span>}
        </div>
    );
};

export default function Gameboard({ game, currentUserId }: GameboardProps) {
    const { toast } = useToast();
    const router = useRouter();
    const logScrollAreaRef = useRef<HTMLDivElement>(null);
    const firestore = useFirestore();
    const { user } = useUser();

    const [isProcessing, setIsProcessing] = useState(false);
    const [eventAlert, setEventAlert] = useState<{title: string, description: string} | null>(null);
    const [interaction, setInteraction] = useState<any>(null);
    const [peekedData, setPeekedData] = useState<{ title: string, cards: CardDefinition[] } | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [showSkipBotButton, setShowSkipBotButton] = useState(false);
    
    const currentPlayerId = game.state.turnOrder?.[game.state.currentPlayerIndex ?? 0];
    const isHumanPlayer = !!user;
    const isBotTurn = !!currentPlayerId?.startsWith('bot_');
    const isMyTurn = currentPlayerId === currentUserId;
    
    // Tracks the last action log count to detect changes
    const lastActionLogLength = useRef(game.state.actionLog?.length || 0);
    useEffect(() => {
        if (logScrollAreaRef.current && game.state.actionLog && game.state.actionLog.length > lastActionLogLength.current) {
            logScrollAreaRef.current.scrollTo({
                top: logScrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
            lastActionLogLength.current = game.state.actionLog.length;
        }
    }, [game.state.actionLog]);

    useEffect(() => {
        // This effect cleans up local UI state whenever the turn changes.
        // This prevents a player from being stuck with a stale UI from the previous player's turn.
        setIsProcessing(false);
        setInteraction(null);
        setEventAlert(null);
        setPeekedData(null);
        setShowSkipBotButton(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPlayerId]);


    useEffect(() => {
        if (game.state.status !== 'playing' || !isBotTurn || !firestore) {
            return;
        }
        
        const isAnyPlayerClient = true; // In a decentralized model, any client can trigger.
        if (!isAnyPlayerClient) return;

        let botActionTimer: NodeJS.Timeout;
        let skipButtonTimer: NodeJS.Timeout;

        // This timeout introduces a small delay before the bot acts, making its turn feel more natural.
        botActionTimer = setTimeout(() => {
            // Final check to ensure the turn hasn't changed while we were waiting
            if (game.state.turnOrder?.[game.state.currentPlayerIndex ?? 0] === currentPlayerId) {
                setIsProcessing(true);
                handleBotTurn(firestore, game.id, currentPlayerId)
                .catch(err => {
                    console.error("Failed to handle bot turn", err);
                     toast({
                        variant: 'destructive',
                        title: 'Bot Error',
                        description: `The bot encountered an error: ${err.message}`,
                    });
                })
                .finally(() => {
                    // isProcessing is reset by the main turn change effect
                });
            }
        }, 2000); // 2 second delay for bot to act

        // Set a timer to show the skip button after 10 seconds
        if(isHumanPlayer){
            skipButtonTimer = setTimeout(() => {
                setShowSkipBotButton(true);
            }, 10000);
        }


        return () => {
            clearTimeout(botActionTimer);
            clearTimeout(skipButtonTimer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.id, currentPlayerId, game.state.status, isBotTurn, firestore, isHumanPlayer]);

    const [showGameResults, setShowGameResults] = useState(false);
    useEffect(() => {
        if (game.state.status === 'finished' && !showGameResults) {
            setShowGameResults(true);
            // The first client to notice the game is over will try to record the stats.
            // The server-side logic and `statsRecorded` flag prevent duplicate recordings.
            if (user && !game.state.statsRecorded) {
                user.getIdToken().then(token => {
                    recordGameStats(game.id, token);
                });
            }
        }
    }, [game.state.status, showGameResults, game.id, game.state.statsRecorded, user]);


    const handleDrawCard = async () => {
        if (!isMyTurn || isProcessing || isEliminated) return;
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Action Failed', description: 'Database connection not available.' });
            return;
        }
        setIsProcessing(true);
        try {
            const result = await drawCard(firestore, game.id, currentUserId);
            if (result.message.includes('Trap') || result.message.includes('Killer') || result.message.includes('Zombie')) {
                 setEventAlert({ title: result.message.includes('Trap') ? "It's a Trap!" : "A Threat Appears!", description: result.message });
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Action Failed',
                description: error.message || 'Could not perform action.',
            });
             setIsProcessing(false); // Make sure to reset processing on failure
        }
        // isProcessing is reset by the useEffect on turn change if successful
    }

    const handleSkipBotTurn = async () => {
        if (!isBotTurn || isProcessing || !firestore) return;

        setIsProcessing(true);
        try {
            await skipBotTurn(firestore, game.id, currentPlayerId);
            toast({ title: 'Bot Skipped', description: `Forced ${currentPlayerId} to draw a card.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Skip Bot', description: error.message });
            setIsProcessing(false);
        }
    };


    const localPlayerHand = game.state.playerHands?.[currentUserId] as CardDefinition[] || [];

    const isCardPlayable = (card: CardDefinition): boolean => {
        if (!isMyTurn || isProcessing || isEliminated) return false;
        
        switch (card.name) {
            case 'Trap':
            case 'Killer':
            case 'Zombie':
            case 'Zombie Survivor':
                return false; 

            case 'Search the Dead':
                return Object.values(game.state.eliminatedPlayers || {}).some((p: any) => p.hand?.length > 0);

            case 'Steal':
            case 'You go first!':
                 return game.players.some(p => p.id !== currentUserId && !game.state.eliminatedPlayers?.[p.id] && !game.state.survivors?.[p.id]);
            
            default:
                if (card.special?.startsWith('key-')) {
                    const keyNum = card.special.split('-')[1];
                    const part = card.special.split('-')[2];
                    const counterpart = part === 'A' ? 'B' : 'A';
                    const counterpartSpecial = `key-${keyNum}-${counterpart}`;
                    return localPlayerHand.some(c => c.special === counterpartSpecial);
                }
                
                return card.playable;
        }
    }

    const handleCardClick = async (card: CardDefinition) => {
        if (!isCardPlayable(card)) return;

        if (card.name === 'Search the Dead') {
            const corpsesWithCards = Object.entries(game.state.eliminatedPlayers ?? {})
                .filter(([_, p]:[string, any]) => p.hand?.length > 0);
            if(corpsesWithCards.length > 0) {
                 const availableFlashlights = localPlayerHand.filter(c => c.name === 'Flashlight' || c.name === 'Strong Flashlight');
                setInteraction({ 
                    type: 'search_dead', 
                    card, 
                    corpses: corpsesWithCards.map(([id, p]: [string, any]) => ({ id, name: p.name, hand: p.hand })),
                    availableFlashlights,
                });
            } else {
                toast({ title: "No one to search", description: "There are no eliminated players with cards in their hand." });
            }
        } else if (card.special?.startsWith('key-')) {
            const keyNum = card.special.split('-')[1];
            const part = card.special.split('-')[2];
            const counterpart = part === 'A' ? 'B' : 'A';
            const counterpartSpecial = `key-${keyNum}-${counterpart}`;
            const counterpartCard = localPlayerHand.find(c => c.special === counterpartSpecial);
            if (counterpartCard) {
                setInteraction({ type: 'confirm_play', card: { name: 'Skeleton Key', description: card.description, playable: true, type: 'Special', quantity: 0 }, options: { cardName1: card.name, cardName2: counterpartCard.name } });
            } else {
                 toast({ title: "Missing Key Part", description: "You need the other part of this key to play it." });
            }
        } else if (card.name === 'Flashlight' || card.name === 'Strong Flashlight') {
            const peekableCorpses = Object.entries(game.state.eliminatedPlayers ?? {})
                .filter(([_, p]:[string, any]) => p.hand?.length > 0)
                .map(([id, p]: [string, any]) => ({ id, name: p.name }));

            setInteraction({ type: 'peek', card, peekableCorpses });
        } else if (card.name === 'Steal' || card.name === 'You go first!') {
             const targetPlayers = game.players.filter(p => p.id !== currentUserId && !game.state.eliminatedPlayers?.[p.id] && !game.state.survivors?.[p.id]);
             if (targetPlayers.length > 0) {
                setInteraction({ type: 'select_player', card, players: targetPlayers });
             } else {
                toast({ variant: 'destructive', title: 'No valid targets', description: 'There are no other active players to target.' });
             }
        } else {
            setInteraction({ type: 'confirm_play', card, options: {} });
        }
    };


    const submitInteraction = async (payload: any) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Action Failed', description: 'Database connection not available.' });
            return;
        }
        setIsProcessing(true);
        setInteraction(null);
        try {
            const { card, options } = payload;
            
            const result = await playCard(firestore, game.id, currentUserId, card.name, options);
            
            if (result.message?.includes('Trap') || result.message?.includes('Killer') || result.message?.includes('Zombie')) {
                 setEventAlert({ title: result.message.includes('Trap') ? "It's a Trap!" : "A Threat!", description: result.message });
            }
            if (result.peekedData) {
                setPeekedData(result.peekedData);
            }
            
            if(!result.turnEnded) {
                setIsProcessing(false);
            }

        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Action Failed',
                description: error.message || 'Could not play card.',
            });
             setIsProcessing(false);
        }
    };
    
    const isEliminated = !!game.state.eliminatedPlayers?.[currentUserId];
    const isSurvivor = !!game.state.survivors?.[currentUserId];

    const sortedPlayers = [...game.players].sort((a, b) => a.seat - b.seat);
    const currentPlayerInfo = game.players.find(p => p.id === currentPlayerId);
    
    const isZombieEdition = game.expansion === 'zombie-edition';
    const threatCardName = isZombieEdition ? 'Zombie' : 'Killer';
    const killerCount = game.state.deck?.filter((c: CardDefinition) => c.special === 'killer').length || 0;
    const zombieCount = game.state.deck?.filter((c: CardDefinition) => c.name === 'Zombie').length || 0;
    const zombieSurvivorCount = game.state.deck?.filter((c: CardDefinition) => c.name === 'Zombie Survivor').length || 0;


    const goalStatus = (goalName: string, count: number) => {
        const completed = game.state.completedGoals?.[goalName]?.length || 0;
        return `${completed} / ${count}`;
    }

    if (isSurvivor) {
        return <div className="container py-16 text-center"><h1 className="text-4xl font-bold text-green-400">You have survived!</h1><p className="text-muted-foreground">You escaped the killer! Waiting for game to end...</p></div>
    }


    return (
        <div className="w-full min-h-screen bg-background text-foreground p-2 sm:p-4 flex flex-col">
            {isEliminated && (
                <div className="bg-destructive text-destructive-foreground text-center p-2 font-bold rounded-lg mb-4">
                    You have been eliminated. You are now spectating.
                </div>
            )}
            {/* Top Bar: Other players and game info */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2 flex-grow w-full">
                    {sortedPlayers.map(player => {
                        const isEliminatedPlayer = !!game.state.eliminatedPlayers?.[player.id];
                        const hand = isEliminatedPlayer 
                            ? game.state.eliminatedPlayers[player.id].hand 
                            : game.state.playerHands?.[player.id];
                        const handSize = hand?.length || 0;
                        const isCurrentTurnPlayer = player.id === currentPlayerId;
                        return (
                            <PlayerStatus 
                                key={player.id} 
                                player={player} 
                                isCurrentTurn={isCurrentTurnPlayer}
                                isEliminated={isEliminatedPlayer}
                                isSurvivor={!!game.state.survivors?.[player.id]}
                                isCreator={player.id === game.creator.id}
                                handSize={handSize}
                            />
                        )
                    })}
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-4 ml-0 sm:ml-4 w-full sm:w-auto">
                    <div className="text-center p-2 border rounded-lg bg-muted w-full sm:w-40">
                        <p className="font-bold text-lg">Deck</p>
                        <p className="text-2xl">{game.state.deck?.length || 0}</p>
                        {isZombieEdition ? (
                            <>
                                <p className="text-sm text-destructive">{zombieCount} Zombies</p>
                                <p className="text-sm text-destructive/80">{zombieSurvivorCount} Zombie Survivors</p>
                                {game.state.zombieRollModifier !== undefined && (
                                    <p className="text-xs text-muted-foreground">(Horde Roll: +{game.state.zombieRollModifier})</p>
                                )}
                            </>
                        ) : (
                             <p className="text-sm text-destructive">{killerCount} {killerCount === 1 ? threatCardName : `${threatCardName}s`}</p>
                        )}
                    </div>
                     <Button variant="outline" onClick={() => setIsLibraryOpen(true)} className="w-full sm:w-auto">
                        <Library className="mr-2 h-4 w-4" /> Card Library
                    </Button>
                </div>
            </div>

            {/* Center Area: Discard Pile, Goals & Turn Info */}
            <div className="flex-grow flex flex-col md:flex-row items-center justify-center text-center my-4 gap-4 md:gap-8">
                 <div className="w-40 h-56 sm:w-48 sm:h-64 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 flex-shrink-0">
                    {game.state.discardPile && game.state.discardPile.length > 0 ? (
                        <GameCard card={game.state.discardPile[game.state.discardPile.length - 1]} />
                    ): (
                        <p className="text-muted-foreground text-sm">Discard Pile ({game.state.discardPile?.length || 0})</p>
                    )}
                </div>

                <div className="w-full md:w-96">
                    <h2 className="text-2xl font-bold font-headline mb-2">
                        {game.state.eliminatedPlayers?.[currentPlayerId ?? ''] || game.state.survivors?.[currentPlayerId ?? '']
                            ? `${currentPlayerInfo?.name}'s turn is skipped.` 
                            : isMyTurn ? "Your Turn" : `${currentPlayerInfo?.name}'s Turn`
                        }
                    </h2>
                     <div className='border rounded-lg p-4 bg-card/50 mb-4'>
                        <h3 className='font-bold text-lg sm:text-xl mb-2'>Team Goals</h3>
                        <div className='text-left space-y-1 text-sm'>
                            <p>Build a Trap: {goalStatus('Build a Trap', 6)}</p>
                            <p>Repair a Radio: {goalStatus('Repair a Radio', 6)}</p>
                            <p>Repair a Car: {goalStatus('Repair a Car', 6)}</p>
                        </div>
                    </div>
                    {isMyTurn && !isEliminated && (
                         <Button 
                            size="lg" 
                            disabled={isProcessing}
                            onClick={handleDrawCard}
                            className="w-full"
                        >
                             {isProcessing && <Loader2 className="animate-spin mr-2" />}
                            Draw Card & End Turn
                        </Button>
                    )}
                    {isBotTurn && game.state.status === 'playing' && (
                        <div className="flex flex-col items-center justify-center gap-2 mt-4">
                            <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin" />
                                <span>{currentPlayerInfo?.name} is thinking...</span>
                            </div>
                            {showSkipBotButton && isHumanPlayer && (
                                <Button variant="destructive" size="sm" onClick={handleSkipBotTurn} disabled={isProcessing}>
                                    Skip Bot's Turn
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                 <div className="w-full md:w-96 md:border-l md:pl-8 hidden md:block">
                    <h3 className="text-xl font-bold font-headline mb-4 flex items-center gap-2"><Library /> Game Log</h3>
                    <ScrollArea className="h-48 p-3 rounded-lg bg-muted/30 border text-left text-sm" viewportRef={logScrollAreaRef}>
                        <div className="flex flex-col gap-2">
                            {game.state.actionLog && game.state.actionLog.length > 0 ? (
                            game.state.actionLog.map((message, index) => (
                                <div key={index} className={cn("p-2 rounded-lg", index === game.state.actionLog!.length - 1 ? "bg-accent/10 text-accent-foreground" : "opacity-70")}>
                                <p className="font-medium text-xs">{message}</p>
                                </div>
                            ))
                            ) : (
                            <p className="text-muted-foreground p-2">Game has just started...</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

             {/* Game Log for Mobile */}
            <div className="md:hidden w-full my-4">
                <Accordion type="single" collapsible>
                  <AccordionItem value="log">
                    <AccordionTrigger>
                      <h3 className="text-lg font-bold font-headline flex items-center gap-2"><Library /> Game Log</h3>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-48 p-3 rounded-lg bg-muted/30 border text-left text-sm" viewportRef={logScrollAreaRef}>
                          <div className="flex flex-col gap-2">
                              {game.state.actionLog && game.state.actionLog.length > 0 ? (
                              game.state.actionLog.map((message, index) => (
                                  <div key={index} className={cn("p-2 rounded-lg", index === game.state.actionLog!.length - 1 ? "bg-accent/10 text-accent-foreground" : "opacity-70")}>
                                  <p className="font-medium text-xs">{message}</p>
                                  </div>
                              ))
                              ) : (
                              <p className="text-muted-foreground p-2">Game has just started...</p>
                              )}
                          </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
            </div>

            {/* Bottom Bar: Current Player Hand & Actions */}
            {!isEliminated && (
                <div className="mt-auto">
                    <div className="mb-2 text-center">
                        <h3 className="font-bold text-lg">Your Hand ({localPlayerHand.length})</h3>
                    </div>
                    <ScrollArea className="w-full">
                        <div className="flex flex-nowrap justify-start items-end gap-2 p-4 bg-muted/20 rounded-lg border min-h-64 sm:min-h-72">
                            {localPlayerHand.length > 0 ? (
                                localPlayerHand.map((card, index) => (
                                <div key={`${card.id}-${index}`} className="flex-shrink-0">
                                    <GameCard 
                                        card={card} 
                                        isPlayable={isCardPlayable(card)}
                                        onPlay={() => handleCardClick(card)}
                                    />
                                </div>
                                ))
                            ) : (
                            <div className="w-full flex items-center justify-center">
                                <p className="text-muted-foreground">You have no cards.</p>
                            </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            )}


            {/* Event Alert Dialog */}
             <AlertDialog open={!!eventAlert} onOpenChange={() => setEventAlert(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>{eventAlert?.title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {eventAlert?.description}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setEventAlert(null)}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {/* Interaction Dialogs */}
            <InteractionManager
                interaction={interaction}
                isProcessing={isProcessing}
                onClose={() => setInteraction(null)}
                onSubmit={submitInteraction}
                game={game}
            />

            {/* Peek Data Dialog */}
            <Dialog open={!!peekedData} onOpenChange={() => setPeekedData(null)}>
                <DialogContent className="max-w-md w-[90%]">
                    <DialogHeader>
                        <DialogTitle>{peekedData?.title}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-72">
                        <div className="flex flex-wrap justify-center gap-2 py-4">
                            {peekedData?.cards.length ? (
                                peekedData.cards.map((card, index) => <GameCard key={index} card={card} />)
                            ) : (
                                <p className="text-muted-foreground">Nothing to see here.</p>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setPeekedData(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CardLibraryDialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen} />

        </div>
    );
}

export function GameResultsDialog({ open, game }: { open: boolean, game: Game }) {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState(120);

    useEffect(() => {
        if (open && game.deletedAt) {
            const calculateTimeLeft = () => {
                const now = Date.now();
                const secondsRemaining = Math.max(0, Math.floor((game.deletedAt! - now) / 1000));
                setTimeLeft(secondsRemaining);

                if (secondsRemaining <= 0) {
                    router.push('/lobby/killer-escape');
                }
            };

            calculateTimeLeft();
            const interval = setInterval(calculateTimeLeft, 1000);
            return () => clearInterval(interval);
        }
    }, [open, game.deletedAt, router]);

    if (!open) return null;

    const eliminatedPlayersList = Object.values(game.state.eliminatedPlayers || {});
    const survivorPlayersList = Object.values(game.state.survivors || {});

    // Players who were not eliminated or explicitly survivors when the game ended are survivors by default (e.g. team goal win)
    const activePlayersAsSurvivors = game.players
        .filter(p => 
            !eliminatedPlayersList.some((e: any) => e.id === p.id) &&
            !survivorPlayersList.some((s: any) => s.id === p.id)
        )
        .map(p => ({ id: p.id, name: p.name, method: 'Survived by Team Goal' }));
    
    const allSurvivors = [...survivorPlayersList, ...activePlayersAsSurvivors];

    const lastMessage = game.state.actionLog?.[game.state.actionLog.length - 1] || "The game has concluded.";
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <Dialog open={open} onOpenChange={() => router.push('/lobby/killer-escape')}>
            <DialogContent className="max-w-2xl w-[90%]">
                 <DialogHeader>
                    <DialogTitle className="text-3xl sm:text-5xl font-bold font-headline text-primary text-center">Game Over</DialogTitle>
                    <DialogDescription className="text-base sm:text-lg text-muted-foreground text-center">{lastMessage}</DialogDescription>
                 </DialogHeader>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 py-4">
                    <Card className="bg-green-500/10 border-green-400">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-center gap-2 text-green-300">
                                <PartyPopper /> Survivors
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {allSurvivors.length > 0 ? (
                                <ul className="space-y-2 text-center">
                                    {allSurvivors.map((p: any) => (
                                        <li key={p.id} className="font-semibold">{p.name} <span className="text-sm text-green-200/80">({p.method})</span></li>
                                    ))}
                                </ul>
                            ) : <p className="text-muted-foreground text-center">No one survived.</p>}
                        </CardContent>
                    </Card>
                    <Card className="bg-destructive/10 border-destructive">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-center gap-2 text-red-400">
                                <Skull /> Eliminated
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {eliminatedPlayersList.length > 0 ? (
                                <ul className="space-y-2 text-center">
                                    {eliminatedPlayersList.map((p: any) => (
                                        <li key={p.id} className="font-semibold">
                                            {p.name}
                                            {p.method && <span className="text-sm text-yellow-300/80 block">({p.method})</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-muted-foreground text-center">No one was eliminated.</p>}
                        </CardContent>
                    </Card>
                 </div>
                 <DialogFooter className='flex-col sm:flex-row sm:justify-between items-center gap-2'>
                     <div className='flex items-center gap-2 text-muted-foreground'>
                        <Timer className="h-4 w-4" />
                        <span>Closing in {minutes}:{seconds < 10 ? `0${seconds}` : seconds}</span>
                     </div>
                    <Button onClick={() => router.push('/lobby/killer-escape')}>Back to Lobby</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function InteractionManager({ interaction, onClose, onSubmit, isProcessing, game }: any) {
    const [selectedValue, setSelectedValue] = useState('');
    const [useFlashlight, setUseFlashlight] = useState(false);
    const [peekChoice, setPeekChoice] = useState('deck');
    const [selectedCardToTake, setSelectedCardToTake] = useState('');

    useEffect(() => {
        if (interaction) {
            setSelectedValue('');
            setUseFlashlight(false);
            setSelectedCardToTake('');
            if(interaction.type === 'peek') {
                setPeekChoice('deck');
            }
        }
    }, [interaction]);

    if (!interaction) return null;

    const { type, card, players, options = {}, peekableCorpses, corpses } = interaction;
    
    const handleSubmit = () => {
        let submissionOptions = { ...options };
        if (type === 'select_player') {
             if (!selectedValue) return;
            submissionOptions.targetPlayerId = selectedValue;
        } else if (type === 'search_dead') {
             if (!selectedValue) return;
            submissionOptions.targetPlayerId = selectedValue;
            submissionOptions.useFlashlight = useFlashlight;
            if(useFlashlight) {
                if(!selectedCardToTake) return;
                submissionOptions.cardToTake = selectedCardToTake;
            }
        }
         else if (type === 'peek') {
            submissionOptions.peekChoice = peekChoice;
            if (peekChoice === 'corpse') {
                 if (!selectedValue) return;
                 submissionOptions.targetPlayerId = selectedValue;
            }
        }
        
        onSubmit({card, options: submissionOptions});
    }

    const renderSearchTheDead = () => {
        const selectedCorpse = corpses.find((c: any) => c.id === selectedValue);
        return (
            <div className="space-y-4">
                <div>
                    <Label>Select a corpse to search:</Label>
                    <RadioGroup onValueChange={setSelectedValue} value={selectedValue} className="mt-2">
                        {corpses.map((p: any) => (
                            <div key={p.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={p.id} id={p.id} />
                                <Label htmlFor={p.id}>{p.name}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                {selectedValue && interaction.availableFlashlights.length > 0 && (
                    <div className="flex items-center space-x-2">
                        <Checkbox id="use-flashlight" checked={useFlashlight} onCheckedChange={(checked) => setUseFlashlight(Boolean(checked))} />
                        <Label htmlFor="use-flashlight">Use {interaction.availableFlashlights[0].name} to see their cards?</Label>
                    </div>
                )}
                
                {useFlashlight && selectedCorpse && (
                     <div>
                        <Label>Select a card to take:</Label>
                         <ScrollArea className="max-h-48 mt-2 border rounded-md p-2">
                            <RadioGroup onValueChange={setSelectedCardToTake} value={selectedCardToTake} >
                                <div className="flex flex-wrap justify-center gap-2 py-4">
                                {selectedCorpse.hand.map((c: CardDefinition, index: number) => (
                                    <div key={`${c.name}-${index}`} className="flex flex-col items-center space-y-2">
                                        <GameCard card={c} />
                                        <RadioGroupItem value={c.name} id={`${c.name}-${index}`} />
                                    </div>
                                ))}
                                </div>
                            </RadioGroup>
                        </ScrollArea>
                    </div>
                )}
            </div>
        )
    }

    return (
        <Dialog open={!!interaction} onOpenChange={onClose}>
            <DialogContent className="max-w-md w-[90%]">
                <DialogHeader>
                    <DialogTitle>Play: {card.name}</DialogTitle>
                    {card.description && <DialogDescription>{card.description}</DialogDescription>}
                </DialogHeader>
                
                <div className="py-4 max-h-[60vh] overflow-y-auto">
                    {type === 'confirm_play' && `Are you sure you want to play "${card.name}"?`}
                    
                    {type === 'select_player' && (
                        <div>
                            <Label>Select a target:</Label>
                            <RadioGroup onValueChange={setSelectedValue} className="mt-2">
                                {players.map((p: Player) => (
                                    <div key={p.id} className="flex items-center space-x-2">
                                        <RadioGroupItem value={p.id} id={p.id} />
                                        <Label htmlFor={p.id}>{p.name}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    )}

                    {type === 'search_dead' && renderSearchTheDead()}

                    {type === 'peek' && (
                        <div className="space-y-4">
                            <div>
                                <Label>What do you want to peek at?</Label>
                                <RadioGroup value={peekChoice} onValueChange={setPeekChoice} className="mt-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="deck" id="peek-deck" />
                                        <Label htmlFor="peek-deck">The top of the deck</Label>
                                    </div>
                                    {peekableCorpses.length > 0 && (
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="corpse" id="peek-corpse" />
                                        <Label htmlFor="peek-corpse">An eliminated player's hand</Label>
                                    </div>
                                    )}
                                </RadioGroup>
                            </div>
                            {peekChoice === 'corpse' && (
                                <div>
                                    <Label>Select a corpse to peek at:</Label>
                                    <RadioGroup onValueChange={setSelectedValue} className="mt-2">
                                        {peekableCorpses.map((p: any) => (
                                            <div key={p.id} className="flex items-center space-x-2">
                                                <RadioGroupItem value={`peek-target-${p.id}`} id={`peek-target-${p.id}`} />
                                                <Label htmlFor={`peek-target-${p.id}`}>{p.name}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={
                            isProcessing || 
                            ((type === 'select_player') && !selectedValue) ||
                            (type === 'search_dead' && !selectedValue) ||
                            (type === 'search_dead' && useFlashlight && !selectedCardToTake) ||
                            (type === 'peek' && peekChoice === 'corpse' && !selectedValue)
                        }
                    >
                         {isProcessing && <Loader2 className="animate-spin mr-2" />}
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
