import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { enrollUser } from "../services/fabricCA.js";
import { logAction } from "../services/auditLog.js";

const router = Router();

// POST /api/wallet/enroll — tạo wallet cho MANAGER, trả JSON để tải về
router.post("/enroll", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
    try {
        const wallet = await enrollUser(req.user.username);
        await logAction(req.user.id, "ENROLL_WALLET", `Tạo ví danh tính blockchain cho ${req.user.username}`);

        res.json({ ok: true, wallet });
    } catch (e) {
        // Nếu đã đăng ký rồi thì thông báo
        if (String(e.message).includes("already registered") || String(e.message).includes("already enrolled")) {
            return res.status(400).json({ ok: false, message: "Danh tính đã được đăng ký. Nếu mất ví, hãy liên hệ Admin." });
        }
        next(e);
    }
});

export default router;
