import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../src/db.js";
import { createSession, deleteSession } from "../src/sessionStore.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ ok: false, message: "Vui lòng nhập tên đăng nhập và mật khẩu" });
        }

        const r = await pool.query("SELECT id, username, password_hash, role FROM users WHERE username=$1", [username]);
        const user = r.rows[0];
        if (!user) return res.status(401).json({ ok: false, message: "Sai tên đăng nhập hoặc mật khẩu" });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ ok: false, message: "Sai tên đăng nhập hoặc mật khẩu" });

        const token = createSession({ userId: user.id, role: user.role, username: user.username });

        res.json({
            ok: true,
            data: {
                token,
                user: { id: user.id, username: user.username, role: user.role },
            },
        });
    } catch (e) {
        next(e);
    }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
    res.json({ ok: true, data: { user: req.user } });
});

// PUT /api/auth/change-password
router.put("/change-password", requireAuth, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body || {};
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ ok: false, message: "Vui lòng nhập đầy đủ mật khẩu cũ và mới" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ ok: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
        }

        // Lấy hash hiện tại
        const r = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
        if (r.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy người dùng" });
        }

        // Verify mật khẩu cũ
        const match = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
        if (!match) {
            return res.status(401).json({ ok: false, message: "Mật khẩu cũ không đúng" });
        }

        // Hash và update mật khẩu mới
        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [newHash, req.user.id]);

        res.json({ ok: true, message: "Đổi mật khẩu thành công" });
    } catch (e) {
        next(e);
    }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, (req, res) => {
    deleteSession(req.token);
    res.json({ ok: true });
});

export default router;
