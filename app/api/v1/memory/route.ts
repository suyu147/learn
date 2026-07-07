import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list memory entries
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(_req: NextRequest) {
  // TODO: Implement create memory entry
  return NextResponse.json({ success: true, data: null });
}
