import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement cancel turn
  return NextResponse.json({ success: true, data: null });
}
