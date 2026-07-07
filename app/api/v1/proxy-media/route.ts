import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement media proxy (fetch and stream remote media)
  return NextResponse.json({ success: true, data: null });
}
