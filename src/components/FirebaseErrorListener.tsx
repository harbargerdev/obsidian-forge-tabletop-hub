
'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { X } from 'lucide-react';

export default function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (e: FirestorePermissionError) => {
      console.log('Caught permission error in listener:', e);
      setError(e);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.removeListener('permission-error', handleError);
    };
  }, []);

  if (!error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Alert variant="destructive" className="max-w-2xl w-full shadow-2xl">
         <button 
            onClick={() => setError(null)} 
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/20 transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
        </button>
        <AlertTitle className="text-xl font-bold">Firestore Security Rules Error</AlertTitle>
        <AlertDescription className="mt-4">
            <p className="text-base">Your request was denied. Here's the context:</p>
            <pre className="mt-2 p-3 bg-background/50 rounded-md text-xs overflow-auto">
                <code>{error.message.replace('FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:', '')}</code>
            </pre>
        </AlertDescription>
      </Alert>
    </div>
  );
}
