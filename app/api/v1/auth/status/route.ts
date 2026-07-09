/**
 * GET /api/v1/auth/status — Returns current auth mode, user info, and token
 *
 * This endpoint is excluded from the middleware matcher (public path).
 * Used by the frontend to discover the auth configuration on startup.
 * In disabled/single mode, also returns a pre-issued JWT so the frontend
 * can immediately use it for Authorization headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthMode,
  authenticate,
  createToken,
  type CurrentUser,
} from '@/lib/deeptutor/services/auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const mode = getAuthMode();

    let user: CurrentUser | null = null;
    let token: string | undefined;

    if (mode !== 'multi') {
      // In disabled/single mode, authenticate() returns the default user
      user = await authenticate(request as unknown as Request);
      // Issue a real JWT so the frontend can use it for subsequent requests
      token = await createToken(user.id, user.username, user.role);
    }

    return NextResponse.json({
      success: true,
      data: {
        mode,
        user: user
          ? { id: user.id, username: user.username, role: user.role }
          : null,
        token,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to get auth status' },
      { status: 500 },
    );
  }
}
