import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement get co-writer document by id
  return NextResponse.json({ success: true, data: null });
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement update co-writer document
  return NextResponse.json({ success: true, data: null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  // TODO: Implement delete co-writer document
  return NextResponse.json({ success: true, data: null });
}
