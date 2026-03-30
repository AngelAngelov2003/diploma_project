const pool = require("../db");

const WATER_BODY_MATERIALIZED_VIEWS = [
  "water_bodies_map_mv",
  "water_bodies_marker_mv",
];

const refreshWaterBodyMaterializedViews = async (db = pool) => {
  for (const viewName of WATER_BODY_MATERIALIZED_VIEWS) {
    await db.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
  }
};

module.exports = {
  refreshWaterBodyMaterializedViews,
  WATER_BODY_MATERIALIZED_VIEWS,
};
