import express from "express";
import cors from "cors";

import authRouter from "../routes/auth.js";
import usersRouter from "../routes/users.js";
import recordsRouter from "../routes/records.js";
import publicRouter from "../routes/public.js";
import blockchainRouter from "../routes/blockchain.js";
import walletRouter from "../routes/wallet.js";
import dashboardRouter from "../routes/dashboard.js";
import auditLogsRouter from "../routes/auditLogs.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/records", recordsRouter);
app.use("/api/public", publicRouter);
app.use("/api/blockchain", blockchainRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit-logs", auditLogsRouter);

// error handler cơ bản
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ ok: false, message: "Lỗi máy chủ" });
});

export default app;
