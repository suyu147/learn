import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Implement chat endpoint with SSE streaming
  return NextResponse.json({ success: true, data: null });
}
