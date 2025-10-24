
'use client';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, User } from 'lucide-react';
import { ChangeNameDialog } from './ChangeNameDialog';
import { useState, useCallback } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';


export function Header() {
  const { user, auth, loading } = useUser();
  const isAdmin = user?.email === 'coburnreptiles@gmail.com';
  const [isChangeNameOpen, setIsChangeNameOpen] = useState(false);

  const loginWithGoogle = useCallback(async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error during Google login:', error);
    }
  }, [auth]);

  const logout = useCallback(async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [auth]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
        >
          <Link href="/" className="text-2xl font-bold font-headline text-primary mr-6">
            Obsidian Forge
          </Link>
        </motion.div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            {!loading && (
              user ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Settings />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        <span>{user.displayName || user.email}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setIsChangeNameOpen(true)}>
                        Change Display Name
                      </DropdownMenuItem>
                      {isAdmin && (
                        <Link href="/admin">
                          <DropdownMenuItem>
                              Admin
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout}>
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChangeNameDialog open={isChangeNameOpen} onOpenChange={setIsChangeNameOpen} />
                </>
              ) : (
                <Button onClick={loginWithGoogle}>Sign in with Google</Button>
              )
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
