import { Router } from "express";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import adminTransactionsRoutes from "./routes/adminTransactions.js";
import adminSubscriptionsRoutes from "./routes/adminSubscriptions.js";
import adminAIUsageRoutes from "./routes/adminAIUsage.js";
import adminSettingsRoutes from "./routes/adminSettings.js";
import adminDashboardRoutes from "./routes/adminDashboard.js";

const router = Router();

// Mount admin routes
router.use("/auth", adminAuthRoutes);
router.use("/users", adminUsersRoutes);
router.use("/transactions", adminTransactionsRoutes);
router.use("/subscriptions", adminSubscriptionsRoutes);
router.use("/ai-usage", adminAIUsageRoutes);
router.use("/settings", adminSettingsRoutes);
router.use("/dashboard", adminDashboardRoutes);

export default router;
