import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";
import settingsRouter from "./settings";
import billsRouter from "./bills";
import purchasesRouter from "./purchases";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import stockAdjustmentsRouter from "./stock-adjustments";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(authRouter);

// Protected routes
router.use(requireAuth);
router.use(productsRouter);
router.use(customersRouter);
router.use(suppliersRouter);
router.use(settingsRouter);
router.use(billsRouter);
router.use(purchasesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(stockAdjustmentsRouter);

export default router;
