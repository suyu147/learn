import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list knowledge bases
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(_req: NextRequest) {
  // TODO: Implement create knowledge base
  return NextResponse.json({ success: true, data: null });
}
