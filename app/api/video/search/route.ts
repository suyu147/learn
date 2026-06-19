import { NextRequest, NextResponse } from 'next/server';
import { searchVideos } from '@/lib/video/search-aggregator';

export async function POST(request: NextRequest) {
  const { knowledgePoints, config } = (await request.json()) as {
    knowledgePoints?: string[];
    config?: Record<string, unknown>;
  };

  if (!knowledgePoints?.length) {
    return NextResponse.json({ error: 'knowledgePoints is required' }, { status: 400 });
  }

  try {
    const result = await searchVideos(knowledgePoints, config ?? {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
