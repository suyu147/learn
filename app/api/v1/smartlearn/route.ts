import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list smartlearn sessions
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(_req: NextRequest) {
  // TODO: Implement create smartlearn session
  return NextResponse.json({ success: true, data: null });
}
