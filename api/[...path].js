const app = require("../backend/dist/app").default;

module.exports = (req, res) => {
  return app(req, res);
};
