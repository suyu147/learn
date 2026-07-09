/**
 * GET  /api/v1/profile — Get user's learning profile
 * POST /api/v1/profile — Update user's learning profile
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getLearningService } from '@/lib/deeptutor/bootstrap';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const log = createLogger('ProfileRoute');

function getUserId(req: NextRequest): string {
  return req.headers.get('x-user-id') ?? 'anonymous';
}

function apiError(err: unknown, fallbackStatus: number = 500) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  log.error('error', err);
  return new Response(JSON.stringify({ error: message }), {
    status: fallbackStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const svc = getLearningService();

    const [skillMap, weakTopics, strongTopics, schedule] = await Promise.all([
      svc.getSkillMap(userId),
      svc.getWeakTopics(userId),
      svc.getStrongTopics(userId),
      svc.getSchedule(userId),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          userId,
          skillMap,
          weakTopics,
          strongTopics,
          schedule,
          generatedAt: new Date().toISOString(),
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    log.error('GET /api/v1/profile failed:', err);
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { validatedBody } = await import('@/lib/server/validate');
    const { ProfileUpdateSchema } = await import('@/lib/server/schemas');
    const body = await validatedBody(ProfileUpdateSchema, req);

    // File-based profile store (no Prisma learningProfile model required)
    const profileDir = join(process.cwd(), 'data', 'learning', userId);
    await mkdir(profileDir, { recursive: true });
    const profilePath = join(profileDir, 'profile.json');

    let existing: Record<string, unknown> = {};
    try {
      const raw = await readFile(profilePath, 'utf-8');
      existing = JSON.parse(raw);
    } catch {
      // no existing profile — start fresh
    }

    const currentDims = (existing.dimensions as Record<string, unknown>) ?? {};
    const mergedDims = { ...currentDims, ...(body.dimensions ?? {}) };
    const currentPrefs = (existing.preferences as Record<string, unknown>) ?? {};
    const mergedPrefs = { ...currentPrefs, ...(body.preferences ?? {}) };

    const profile = {
      userId,
      dimensions: mergedDims,
      preferences: mergedPrefs,
      version: ((existing.version as number) ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf-8');

    return new Response(JSON.stringify({ success: true, data: profile }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'ValidationError') {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('POST /api/v1/profile failed:', err);
    return apiError(err);
  }
}
