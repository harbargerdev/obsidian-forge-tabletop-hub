
'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/firebase';
import AdBanner from '@/components/AdBanner';

const games = [
  {
    id: 'killer-escape',
    title: 'Killer Escape',
    desc: '4-8 players. Draw cards, avoid traps, and survive the killer in a haunted house.',
    image: 'https://picsum.photos/seed/1/600/400',
    imageHint: 'horror house',
  },
];

export default function GameSelector() {
  const navigate = useRouter();
  const { user } = useUser();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="p-4 sm:p-8"
    >
      <div className="text-center mb-10 sm:mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold font-headline mb-4 text-primary">
          Welcome to Obsidian Forge
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          {user
            ? 'Select a game to begin your adventure or join an open lobby.'
            : 'Log in to create games — or browse and join open matches.'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {games.map((g) => (
          <motion.div whileHover={{ y: -5, scale: 1.03 }} key={g.id}>
            <Card
              className="h-full bg-card/50 hover:bg-card/90 border-border/50 hover:border-accent transition-all duration-300 cursor-pointer overflow-hidden group"
              onClick={() => navigate.push(`/lobby/${g.id}`)}
            >
              <div className="aspect-video overflow-hidden">
                <Image
                  src={g.image}
                  alt={g.title}
                  width={600}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  data-ai-hint={g.imageHint}
                />
              </div>
              <CardHeader>
                <CardTitle className="font-headline text-xl sm:text-2xl">{g.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm sm:text-base">{g.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
       <div className="mt-12">
        <AdBanner />
      </div>
    </motion.div>
  );
}
