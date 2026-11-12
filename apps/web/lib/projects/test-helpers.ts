import { vi } from "vitest";

export type QueryResult = { data: unknown; error: { message: string } | null };

/**
 * A fake supabase-js query builder: every builder method returns the same object, and the
 * terminal calls (`maybeSingle`, or awaiting the builder) resolve to `result`.
 * `calls` records each method with its arguments, e.g. `calls.eq` → `[["id", "..."]]`.
 */
export function fakeQuery(result: QueryResult) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "order"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return { builder, calls };
}
