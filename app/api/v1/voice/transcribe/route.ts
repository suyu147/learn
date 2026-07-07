import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Implement voice transcription
  return NextResponse.json({ success: true, data: null });
}
