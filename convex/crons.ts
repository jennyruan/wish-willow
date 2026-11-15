import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 17:00 UTC is 9am PST / 10am PDT: Willow's daily check-in.
crons.daily("keiki daily nudge", { hourUTC: 17, minuteUTC: 0 }, internal.nudge.sendDailyNudges, {});

export default crons;
