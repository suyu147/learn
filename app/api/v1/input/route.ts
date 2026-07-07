import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Implement ask_user response handler
  return NextResponse.json({ success: true, data: null });
}
