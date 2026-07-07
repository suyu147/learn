import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list available agents
  return NextResponse.json({ success: true, data: [] });
}
