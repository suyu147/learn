import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import type { ProfileDimensions } from '@/lib/types/profile';
import { DEFAULT_DIMENSIONS } from '@/lib/types/profile';
import { createLogger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

const log = createLogger('api:smartlearn:profile');

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: userId' },
        { status: 400 },
      );
    }

    log.info(`Profile GET: userId=${userId}`);

    const profile = await prisma.learningProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    if (!profile) {
      return NextResponse.json({
        success: true,
        data: {
          userId,
          dimensions: DEFAULT_DIMENSIONS,
          version: 0,
          isNew: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        userId: profile.userId,
        version: profile.version,
        dimensions: profile.dimensions as unknown as ProfileDimensions,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Profile GET error:', err);
    return NextResponse.json(
      { success: false, error: `Failed to fetch profile: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, dimensions } = body as {
      userId: string;
      dimensions: Partial<ProfileDimensions>;
    };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: userId' },
        { status: 400 },
      );
    }

    log.info(`Profile POST: userId=${userId}`);

    // Merge incoming dimensions with defaults to ensure completeness
    const mergedDimensions: ProfileDimensions = {
      ...DEFAULT_DIMENSIONS,
      ...dimensions,
      knowledgeBase: { ...DEFAULT_DIMENSIONS.knowledgeBase, ...dimensions.knowledgeBase },
      cognitiveStyle: { ...DEFAULT_DIMENSIONS.cognitiveStyle, ...dimensions.cognitiveStyle },
      learningGoals: { ...DEFAULT_DIMENSIONS.learningGoals, ...dimensions.learningGoals },
      weakPoints: { ...DEFAULT_DIMENSIONS.weakPoints, ...dimensions.weakPoints },
      timePreference: { ...DEFAULT_DIMENSIONS.timePreference, ...dimensions.timePreference },
      interests: { ...DEFAULT_DIMENSIONS.interests, ...dimensions.interests },
      learningPace: { ...DEFAULT_DIMENSIONS.learningPace, ...dimensions.learningPace },
      errorPatterns: { ...DEFAULT_DIMENSIONS.errorPatterns, ...dimensions.errorPatterns },
    };

    // Find existing profile to determine next version number
    const existing = await prisma.learningProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = existing ? existing.version + 1 : 1;

    // Cast to Prisma InputJsonValue for storage
    const dimensionsJson = mergedDimensions as unknown as Prisma.InputJsonValue;

    const profile = await prisma.learningProfile.upsert({
      where: { id: existing?.id ?? '__new__' },
      update: {
        dimensions: dimensionsJson,
        version: nextVersion,
      },
      create: {
        userId,
        dimensions: dimensionsJson,
        version: nextVersion,
      },
    });

    log.info(`Profile upserted: userId=${userId}, version=${nextVersion}`);

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        userId: profile.userId,
        version: profile.version,
        dimensions: profile.dimensions as unknown as ProfileDimensions,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Profile POST error:', err);
    return NextResponse.json(
      { success: false, error: `Failed to upsert profile: ${message}` },
      { status: 500 },
    );
  }
}
