import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import type { ProfileDimensions } from '@/lib/types/profile';
import type { Prisma } from '@prisma/client';

const DEFAULT_USER_ID = 'default-user';

/**
 * GET /api/profile
 * 获取当前用户的学习画像列表
 */
export async function GET() {
  try {
    const profiles = await prisma.learningProfile.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('[Profile API] GET error:', error);
    return NextResponse.json(
      { error: '获取画像列表失败' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/profile
 * 保存或更新学习画像
 * Body: { dimensions: ProfileDimensions }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dimensions } = body as { dimensions: ProfileDimensions };

    if (!dimensions) {
      return NextResponse.json(
        { error: '缺少 dimensions 字段' },
        { status: 400 },
      );
    }

    const jsonDimensions = JSON.parse(JSON.stringify(dimensions)) as Prisma.InputJsonValue;

    // 查找当前用户最新画像
    const latest = await prisma.learningProfile.findFirst({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latest ? latest.version + 1 : 1;

    // upsert：存在则更新，不存在则创建
    const profile = await prisma.learningProfile.upsert({
      where: { id: latest?.id ?? '' },
      update: {
        dimensions: jsonDimensions,
        version: nextVersion,
      },
      create: {
        id: crypto.randomUUID(),
        userId: DEFAULT_USER_ID,
        dimensions: jsonDimensions,
        version: nextVersion,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[Profile API] POST error:', error);
    return NextResponse.json(
      { error: '保存画像失败' },
      { status: 500 },
    );
  }
}
