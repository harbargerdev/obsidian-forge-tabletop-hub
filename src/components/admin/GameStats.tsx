
'use client';
import React, { useMemo } from 'react';
import { GameStats as GameStatsType, PlayerCountStats } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const playerCounts = [4, 5, 6, 7, 8];

const defaultStats: PlayerCountStats = {
    finished: 0,
    eliminated: 0,
    sacrificed: 0,
    survivedTeam: 0,
    survivedWithKey: 0,
};

const StatValue = ({ value, total }: { value: number; total: number }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="flex flex-col items-end">
            <span>{value}</span>
            <span className="text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
        </div>
    );
};

const StatColumn = ({ title, stats, gameMode }: { title: string; stats: GameStatsType | null; gameMode: 'baseGame' | 'zombieEdition' }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Players</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {playerCounts.map(count => {
                            const key = `${count}_players`;
                            const data = stats?.[gameMode]?.[key] || defaultStats;
                            const totalOutcomes = data.survivedTeam + data.survivedWithKey + data.eliminated + data.sacrificed;
                            const totalFinishedPlayers = data.finished * count;

                            return (
                                <React.Fragment key={count}>
                                    <TableRow className="bg-muted/30">
                                        <TableHead colSpan={2} className="font-bold text-center">{count} Player Games</TableHead>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Games Finished</TableCell>
                                        <TableCell className="text-right">{data.finished}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Team Survivors</TableCell>
                                        <TableCell className="text-right">
                                            {totalFinishedPlayers > 0 ? <StatValue value={data.survivedTeam} total={totalFinishedPlayers} /> : data.survivedTeam}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Key Escapes</TableCell>
                                        <TableCell className="text-right">
                                            {totalFinishedPlayers > 0 ? <StatValue value={data.survivedWithKey} total={totalFinishedPlayers} /> : data.survivedWithKey}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Eliminated</TableCell>
                                        <TableCell className="text-right">
                                            {totalFinishedPlayers > 0 ? <StatValue value={data.eliminated} total={totalFinishedPlayers} /> : data.eliminated}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Sacrificed for Goal</TableCell>
                                        <TableCell className="text-right">
                                            {totalFinishedPlayers > 0 ? <StatValue value={data.sacrificed} total={totalFinishedPlayers} /> : data.sacrificed}
                                        </TableCell>
                                    </TableRow>
                                    {totalFinishedPlayers > 0 && totalOutcomes !== totalFinishedPlayers && (
                                         <TableRow>
                                            <TableCell colSpan={2} className='text-center text-destructive/80 text-xs'>(Warning: Outcome count ({totalOutcomes}) does not match total players in finished games ({totalFinishedPlayers}). Stats may be misaligned.)</TableCell>
                                         </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export default function GameStats() {
    const firestore = useFirestore();

    const statsRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'game_stats', 'killer-escape');
    }, [firestore]);

    const { data: stats, isLoading, error } = useDoc<GameStatsType>(statsRef);

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading Stats...</div>;
    }

    if (error) {
        return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load game stats: {error.message}</AlertDescription></Alert>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Killer Escape Game Statistics</CardTitle>
                <CardDescription>
                    A breakdown of game outcomes by player count and game mode.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <StatColumn title="Base Game" stats={stats} gameMode="baseGame" />
                <StatColumn title="Zombie Edition" stats={stats} gameMode="zombieEdition" />
            </CardContent>
        </Card>
    );
}
