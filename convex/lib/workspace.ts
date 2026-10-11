import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function findWorkspace(
  ctx: QueryCtx | MutationCtx,
  accessKey: string,
): Promise<Doc<"workspaces"> | null> {
  if (accessKey.length < 32) return null;
  return await ctx.db
    .query("workspaces")
    .withIndex("by_access_key", (q) => q.eq("accessKey", accessKey))
    .unique();
}

export async function requireWorkspace(
  ctx: QueryCtx | MutationCtx,
  accessKey: string,
): Promise<Doc<"workspaces">> {
  const workspace = await findWorkspace(ctx, accessKey);
  if (!workspace) throw new Error("Not authenticated");
  return workspace;
}

export function createAccessKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
