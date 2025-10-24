
export type CardType = 
    | 'Item' 
    | 'Action' 
    | 'Goal' 
    | 'Special'
    | 'Hazard';

export interface CardDefinition {
    id: string;
    name: string;
    type: CardType;
    description: string;
    quantity: number;
    playable: boolean;
    special?: string;
}

export const allKillerEscapeCards: Omit<CardDefinition, 'id'>[] = [
    // --- Hazards ---
    {
        name: "Trap",
        type: 'Hazard',
        description: "BAH! It's a TRAP! Draw 2 cards and shuffle this card back into the deck.",
        quantity: 5,
        playable: false,
        special: 'trap',
    },
    {
        name: 'Killer',
        type: 'Hazard',
        description: 'You have been caught by the Killer. You are eliminated unless you can defend yourself.',
        quantity: 0, // This is dynamically added based on player count
        playable: false,
        special: 'killer',
    },
     // --- Zombie Expansion Hazards ---
    {
        name: 'Zombie',
        type: 'Hazard',
        description: 'A zombie has you cornered! You are eliminated unless you can defend yourself.',
        quantity: 0,
        playable: false,
        special: 'zombie',
    },
    {
        name: 'Zombie Survivor',
        type: 'Hazard',
        description: 'An eliminated player has turned into a zombie! You are eliminated unless you can defend yourself.',
        quantity: 0,
        playable: false,
        special: 'zombie',
    },
    // --- Items ---
    {
        name: "Flashlight",
        type: 'Item',
        description: "A flashlight with weak batteries, search around to see what you can find. Either view the cards in an eliminated player's corpse or view the top 3 cards of the deck.",
        quantity: 5,
        playable: true,
    },
    {
        name: "Strong Flashlight",
        type: 'Item',
        description: "A flashlight with new batteries, search around to see what you can find. Either view the cards in an eliminated player's corpse or view the top 5 cards of the deck.",
        quantity: 5,
        playable: true,
    },
    {
        name: "Random Heavy Object",
        type: 'Item',
        description: "Throw this at a threat and run away! If you draw the Killer or a Zombie while holding this card, discard this card and return the threat to the deck.",
        quantity: 5,
        playable: false,
        special: 'defense',
    },
    // --- Zombie Expansion Items ---
    {
        name: "Shotgun",
        type: 'Item',
        description: "You found a shotgun with only 1 round in the chamber. Hold it at the ready to eliminate a zombie permanently.",
        quantity: 6,
        playable: false,
        special: 'defense-zombie',
    },
    // --- Actions ---
    {
        name: "Run",
        type: 'Action',
        description: "Turn around and run! Skip ending your turn and reverse the turn order.",
        quantity: 5,
        playable: true,
    },
    {
        name: "Hide",
        type: 'Action',
        description: "You found a good place to hide out for a moment, skip drawing a card at the end of your turn.",
        quantity: 5,
        playable: true,
    },
    {
        name: "Search the Dead",
        type: 'Action',
        description: "Your friend may have not made it, but use them to save yourself. It’s what they would have wanted… Take 1 card from a corpse. Use a flashlight to help find what you need!",
        quantity: 5,
        playable: true,
    },
    {
        name: "You go first!",
        type: 'Action',
        description: "No, you go first! I insist! Select who goes next and end your turn without drawing a card.",
        quantity: 5,
        playable: true,
    },
    {
        name: "Steal",
        type: 'Action',
        description: "Steal from a friend to try to save yourself!",
        quantity: 3,
        playable: true,
    },
    // --- Goals ---
    { name: "Build a Trap - Part 1", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Build a Trap - Part 2", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Build a Trap - Part 3", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Build a Trap - Part 4", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Build a Trap - Part 5", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Build a Trap - Part 6", type: 'Goal', description: "Work together to build a trap to catch the killer! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },

    { name: "Repair a Radio - Part 1", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Radio - Part 2", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Radio - Part 3", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Radio - Part 4", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Radio - Part 5", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Radio - Part 6", type: 'Goal', description: "Work together to repair a radio to call for help! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },

    { name: "Repair a Car - Part 1", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Car - Part 2", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Car - Part 3", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Car - Part 4", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Car - Part 5", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },
    { name: "Repair a Car - Part 6", type: 'Goal', description: "Work together to repair a car to try to escape! Be careful as the killer could be lurking! To work on this goal, draw 1 card.", quantity: 1, playable: true },

    // --- Skeleton Keys ---
    { name: "Skeleton Key 1 - Part A", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-1-A' },
    { name: "Skeleton Key 1 - Part B", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-1-B' },
    { name: "Skeleton Key 2 - Part A", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-2-A' },
    { name: "Skeleton Key 2 - Part B", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-2-B' },
    { name: "Skeleton Key 3 - Part A", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-3-A' },
    { name: "Skeleton Key 3 - Part B", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-3-B' },
    { name: "Skeleton Key 4 - Part A", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-4-A' },
    { name: "Skeleton Key 4 - Part B", type: 'Special', description: "Find both parts to repair the key and save yourself! Be careful though, the killer could be waiting. Draw 2 cards. If you do not draw the killer, you survive to play again. This card does activate traps. If you survive, your cards shuffle back into the deck.", quantity: 1, playable: true, special: 'key-4-B' },
];

export const killerEscapeCardList = allKillerEscapeCards.filter(card => {
    const isZombieCard = card.special?.includes('zombie');
    return !isZombieCard;
});
