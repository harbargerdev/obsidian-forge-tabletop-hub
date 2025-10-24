
'use client';

import { useState, useEffect } from 'react';

export interface AnonymousUser {
    id: string;
    name: string;
}

const ANON_USER_KEY = 'obsidian-forge-anonymous-user';

function createAnonymousUser(): AnonymousUser {
    const randomId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const user = {
        id: randomId,
        name: `Player ${randomId.substring(5, 9)}`,
    };
    if (typeof window !== 'undefined') {
        localStorage.setItem(ANON_USER_KEY, JSON.stringify(user));
    }
    return user;
}

function getStoredUser(): AnonymousUser | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const storedUser = localStorage.getItem(ANON_USER_KEY);
    if (storedUser) {
        try {
            return JSON.parse(storedUser);
        } catch (e) {
            return null;
        }
    }
    return null;
}


export function useAnonymousUser(): AnonymousUser | null {
  const [anonUser, setAnonUser] = useState<AnonymousUser | null>(null);

  useEffect(() => {
    // This effect runs only on the client
    const storedUser = getStoredUser();
    if (storedUser) {
      setAnonUser(storedUser);
    } else {
      const newUser = createAnonymousUser();
      setAnonUser(newUser);
    }
  }, []);

  return anonUser;
}
