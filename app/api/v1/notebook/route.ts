import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list notebooks
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(_req: NextRequest) {
  // TODO: Implement create notebook
  return NextResponse.json({ success: true, data: null });
}
