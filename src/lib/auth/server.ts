
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: DecodedIdToken;
}

type ApiHandler = (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse | Response>;

export function requireAuth(handler: ApiHandler) {
  return async (req: AuthenticatedRequest, context: { params: any }) => {
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        req.user = await adminAuth.verifyIdToken(token);
      } catch (error) {
        console.warn('Invalid auth token:', error);
        // Token is invalid, treat as unauthenticated but do not block request.
        // The handler can then decide what to do.
        req.user = undefined; 
      }
    }

    return handler(req, context);
  };
}

export function requireAdmin(handler: ApiHandler) {
  return requireAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    if (!req.user || req.user.email !== 'coburnreptiles@gmail.com') {
      return new NextResponse(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }
    return handler(req, context);
  });
}
