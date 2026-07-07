import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Implement file attachment upload
  return NextResponse.json({ success: true, data: null });
}
