import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Implement get user weak points
  // Expected response shape:
  // {
  //   success: true,
  //   data: [
  //     { topic, subject, errorRate, attempts, hint, severity }
  //   ]
  // }
  return NextResponse.json({ success: true, data: [] });
}
