let app;

try {
  app = require("../backend/dist/app").default;
} catch (err) {
  // If the require fails, return a helpful error
  module.exports = (req, res) => {
    res.status(500).json({
      error: "Function initialization failed",
      details: err.message,
    });
  };
}

if (app) {
  module.exports = (req, res) => {
    return app(req, res);
  };
}