/**
 * POST /api/v1/memory/consolidate — Trigger memory consolidation (L1→L2→L3)
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getMemoryService } from '@/lib/deeptutor/bootstrap';
import type { Surface, TraceEvent } from '@/lib/deeptutor/services/memory';

const log = createLogger('MemoryConsolidateRoute');

function getUserId(req: NextRequest): string {
  return req.headers.get('x-user-id') ?? 'anonymous';
}

function apiError(err: unknown, fallbackStatus: number = 500) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  log.error('error', err);
  return new Response(JSON.stringify({ error: message }), {
    status: fallbackStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const url = new URL(req.url);
    const surface = url.searchParams.get('surface') ?? 'chat';

    const svc = getMemoryService();

    // Read L1 trace events
    const traces = await svc.readTrace(userId, surface as Surface, 100);

    if (!traces || traces.length === 0) {
      return new Response(JSON.stringify({ success: true, data: { consolidated: false, reason: 'No trace events to consolidate' } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build L2 summary from traces
    const summary = traces
      .map((t: TraceEvent) => `[${t.ts}] ${t.kind}: ${JSON.stringify(t.payload ?? {}).slice(0, 200)}`)
      .join('\n');

    await svc.writeL2(userId, surface, summary);

    return new Response(JSON.stringify({ success: true, data: { consolidated: true, traceCount: traces.length, surface } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('POST /api/v1/memory/consolidate failed:', err);
    return apiError(err);
  }
}
