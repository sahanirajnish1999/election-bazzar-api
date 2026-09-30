import { Router } from "express";
import {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  getAllAdmins,
} from "../controllers/adminController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

router.get("/me", authenticateAdmin, getAdminProfile);
router.get("/all", authenticateAdmin, getAllAdmins);

export default router;
