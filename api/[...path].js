let app;
try {
  app = require("../backend/dist/app").default;
} catch (err) {
  console.error("Function initialization failed:", err);
  module.exports = (req, res) => {
    res.status(500).json({ error: "Function initialization failed" });
  };
}
if (app) {
  module.exports = (req, res) => {
    return app(req, res);
  };
}
