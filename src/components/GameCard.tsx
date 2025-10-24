
'use client';
import React from 'react';
import { CardDefinition } from '@/lib/cards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface GameCardProps {
    card: CardDefinition;
    isPlayable?: boolean;
    onPlay?: (cardName: string) => void;
}

export default function GameCard({ card, isPlayable = false, onPlay }: GameCardProps) {

    const badgeVariant = card.type === 'Hazard' ? 'destructive' : 'secondary';

    return (
        <Card
            className={cn(
                "w-36 h-52 sm:w-48 sm:h-64 flex flex-col bg-card shadow-lg transform transition-all duration-300",
                isPlayable ? "cursor-pointer hover:-translate-y-2 hover:shadow-primary/50 hover:ring-2 hover:ring-primary" : "opacity-80",
            )}
            onClick={() => isPlayable && onPlay && onPlay(card.name)}
        >
            <CardHeader className="p-2 sm:p-3">
                <div className='flex justify-between items-start gap-1'>
                    <CardTitle className="text-xs sm:text-base font-bold leading-tight">{card.name}</CardTitle>
                    <Badge variant={badgeVariant} className="text-[10px] sm:text-xs px-1.5 sm:px-2.5 shrink-0">{card.type}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0 flex-grow flex flex-col justify-between">
                <div className="w-full h-16 sm:h-24 bg-muted rounded-md flex items-center justify-center mb-2">
                    <span className="text-muted-foreground text-xs">Image Coming Soon</span>
                </div>
                <CardDescription className="text-[10px] sm:text-xs flex-grow">
                    {card.description}
                </CardDescription>
            </CardContent>
        </Card>
    );
}
