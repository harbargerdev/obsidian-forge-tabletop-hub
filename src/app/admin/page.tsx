
'use client';
import React from 'react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import GameStats from '@/components/admin/GameStats';

export default function AdminPage() {
  const { user, loading } = useUser();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user || user.email !== 'coburnreptiles@gmail.com') {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-8">
        <Card>
            <CardHeader>
            <CardTitle className="font-headline text-3xl">Admin Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
            <p>Welcome, Admin. Here you can view game statistics.</p>
            </CardContent>
        </Card>
        <GameStats />
      </div>
    </div>
  );
}
