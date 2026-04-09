let app;

function sanitizeInitError(err) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
    };
  }

  if (err && typeof err === "object") {
    const source = err;
    return {
      name: typeof source.name === "string" ? source.name : "UnknownError",
      message: typeof source.message === "string" ? source.message : "Initialization failed",
    };
  }

  return { message: String(err) };
}

try {
  app = require("../backend/dist/app").default;
} catch (err) {
  console.error("Function initialization failed:", sanitizeInitError(err));
  module.exports = (req, res) => {
    res.status(500).json({ error: "Function initialization failed" });
  };
}
if (app) {
  module.exports = (req, res) => {
    return app(req, res);
  };
}
