/**
 * Prompt Renderer — Handlebars template rendering
 *
 * Replaces Python's Jinja2 with Handlebars for template rendering.
 * The {{variable}} syntax is compatible between both engines.
 *
 * Registers common helpers that replace Jinja2 filters.
 */

import type { RenderOptions } from './types';

// ---------------------------------------------------------------------------
// Simple template renderer (no external dependency for Phase 0)
//
// We use a lightweight {{variable}} substitution instead of full Handlebars
// to avoid adding a dependency in Phase 0. The syntax is compatible with
// both Jinja2 and Handlebars for simple variable substitution.
// Full Handlebars integration can be added in Phase 2a when prompt
// complexity requires conditionals and loops.
// ---------------------------------------------------------------------------

/** Built-in helper functions */
const HELPERS: Record<string, (value: unknown, ...args: unknown[]) => string> = {
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  json: (v) => JSON.stringify(v, null, 2),
  default: (v, fallback) => String(v ?? fallback ?? ''),
};

/**
 * Render a Handlebars-compatible template string with variable substitution.
 *
 * Supports:
 * - {{variable}} — simple substitution
 * - {{variable.property}} — nested property access
 * - {{upper variable}} — helper functions
 * - {{#if condition}}...{{/if}} — conditional blocks
 * - {{#each list}}...{{/each}} — iteration blocks
 *
 * For Phase 0, only simple substitution and nested properties are implemented.
 * Conditionals and loops will be added when the full Handlebars library is integrated.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown> = {},
): string {
  // Phase 0: Simple {{variable}} and {{variable.property}} substitution
  // Also supports {{helper variable}} for registered helpers
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();

    // Check for helper syntax: {{helperName arg}}
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && HELPERS[parts[0]]) {
      const value = resolveNested(variables, parts[1]);
      return HELPERS[parts[0]](value);
    }

    // Simple variable or nested property
    const value = resolveNested(variables, trimmed);
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/** Resolve a dot-separated property path from an object */
function resolveNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}
