import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement list documents in knowledge base
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement add document to knowledge base
  return NextResponse.json({ success: true, data: null });
}
