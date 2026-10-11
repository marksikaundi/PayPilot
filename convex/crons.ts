import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "mark-overdue-invoices",
  { hourUTC: 0, minuteUTC: 15 },
  internal.invoices.markAllOverdue,
);

export default crons;
