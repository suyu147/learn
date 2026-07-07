import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement list MCP servers
  return NextResponse.json({ success: true, data: [] });
}

export async function POST(_req: NextRequest) {
  // TODO: Implement register MCP server
  return NextResponse.json({ success: true, data: null });
}
