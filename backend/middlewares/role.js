export function requireRole(...allowed) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowed.includes(role)) {
            return res.status(403).json({ ok: false, message: "Không có quyền truy cập" });
        }
        next();
    };
}
