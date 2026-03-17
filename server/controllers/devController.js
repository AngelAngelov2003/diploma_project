const {
  runDailyAlertEmails,
  runWeeklyAlertEmails,
} = require("../services/alertService");
const { getMostRecentScheduledWeeklyDate } = require("../utils/time");

const runAlertsNow = async (req, res) => {
  try {
    const frequency = String(req.query.frequency || req.body?.frequency || "").trim().toLowerCase();

    let result;

    if (frequency === "weekly") {
      result = await runWeeklyAlertEmails({
        force: true,
        deliveryDate: getMostRecentScheduledWeeklyDate(),
      });
    } else if (frequency === "daily") {
      result = await runDailyAlertEmails({
        force: true,
      });
    } else {
      const daily = await runDailyAlertEmails({
        force: true,
      });

      const weekly = await runWeeklyAlertEmails({
        force: true,
        deliveryDate: getMostRecentScheduledWeeklyDate(),
      });

      result = { ok: true, daily, weekly };
    }

    res.json(result);
  } catch (err) {
    console.error("runAlertsNow failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};

module.exports = {
  runAlertsNow,
};