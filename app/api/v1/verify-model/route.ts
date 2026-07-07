import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Implement model verification
  return NextResponse.json({ success: true, data: null });
}
