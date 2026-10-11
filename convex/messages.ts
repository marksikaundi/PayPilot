import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireWorkspace } from "./lib/workspace";

export const list = query({
  args: { accessKey: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_workspace_and_created", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(40);
    return rows.reverse().map((row) => ({
      _id: row._id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  },
});
