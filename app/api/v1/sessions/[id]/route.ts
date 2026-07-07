import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement get session by id
  return NextResponse.json({ success: true, data: null });
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement update session
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement delete session
  return NextResponse.json({ success: true, data: null });
}
