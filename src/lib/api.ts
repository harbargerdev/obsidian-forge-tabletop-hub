
'use client';

import { useUser } from '@/firebase';
import { useCallback } from 'react';

export function useApi() {
  const { user } = useUser();

  const apiFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers = new Headers(opts.headers || {});
      headers.set('Content-Type', 'application/json');

      if (user) {
        try {
          const token = await user.getIdToken();
          headers.set('Authorization', `Bearer ${token}`);
        } catch (error) {
          console.error('Could not get auth token', error);
        }
      }

      const res = await fetch(path, { ...opts, headers });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { error: 'An unknown error occurred', details: text };
      }

      if (!res.ok) {
        const errorMessage =
          data && data.error
            ? data.error
            : 'API request failed';
        console.error('API Fetch Error:', errorMessage, data.details ? `\nDetails: ${data.details}`: '');
        throw new Error(data.error || 'API request failed');
      }

      return data;
    },
    [user]
  );

  return { apiFetch };
}
