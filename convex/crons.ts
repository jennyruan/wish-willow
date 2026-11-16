import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 17:00 UTC is 9am PST / 10am PDT: Willow's daily check-in.
crons.daily("keiki daily nudge", { hourUTC: 17, minuteUTC: 0 }, internal.nudge.sendDailyNudges, {});

// Requeue Whop refunds and payouts that ran out of automatic retries.
crons.daily("whop reconcile", { hourUTC: 9, minuteUTC: 0 }, internal.whop.reconcile, {});

export default crons;
