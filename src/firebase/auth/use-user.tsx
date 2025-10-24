
'use client';

import { useState, useEffect } from 'react';
import { Auth, User, onIdTokenChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

export const useUser = (): { user: User | null; auth: Auth; loading: boolean } => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (newUser) => {
      setUser(newUser);
      setLoading(false);
    });
    // Set loading to false if there's an initial user, otherwise the loading state persists
    if (auth.currentUser) {
        setLoading(false);
    }
    return () => unsubscribe();
  }, [auth]);

  return { user, auth, loading };
};
