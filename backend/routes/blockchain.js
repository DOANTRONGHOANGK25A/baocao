import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { pool } from "../src/db.js";
import { chainRead } from "../services/fabricRecord.js";
import { computeRecordHashByRecordId } from "../services/recordHash.js";

const router = Router();

// ─── GET /api/blockchain/status ─── thông tin mạng blockchain
router.get("/status", requireAuth, async (req, res) => {
    let connectionOk = false;
    let errorMsg = null;

    try {
        // Thử đọc 1 record bất kỳ để test kết nối
        await chainRead("__health_check__");
        connectionOk = true;
    } catch (e) {
        // Nếu lỗi là "không tồn tại" → kết nối OK, chỉ là record không có
        if (String(e.message || "").includes("không tồn tại")) {
            connectionOk = true;
        } else {
            errorMsg = e.message || "Không thể kết nối";
        }
    }

    res.json({
        ok: true,
        data: {
            connected: connectionOk,
            error: errorMsg,
            network: {
                channel: process.env.FABRIC_CHANNEL || "mychannel",
                chaincode: process.env.FABRIC_CHAINCODE || "hoso",
                mspId: process.env.FABRIC_MSPID || "Org1MSP",
                peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || "localhost:7051",
            },
            timestamp: new Date().toISOString(),
        },
    });
});

// ─── GET /api/blockchain/integrity-check ─── kiểm tra toàn vẹn (ADMIN)
router.get("/integrity-check", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const records = await pool.query(
            "SELECT id, record_code, status FROM records WHERE status IN ('CONFIRMED','REVOKED') ORDER BY id ASC"
        );

        const results = [];
        for (const rec of records.rows) {
            const entry = {
                id: rec.id,
                recordCode: rec.record_code,
                offchainStatus: rec.status,
            };

            try {
                const { recordHash } = await computeRecordHashByRecordId(rec.id);
                entry.offchainHash = recordHash;
            } catch (e) {
                entry.offchainHash = null;
                entry.offchainError = e.message;
            }

            try {
                const onchain = await chainRead(rec.record_code);
                entry.onchainHash = onchain.recordHash || null;
                entry.onchainStatus = onchain.status || null;
                entry.onchainTxId = onchain.txId || null;
            } catch (e) {
                entry.onchainHash = null;
                entry.onchainError = e.message;
            }

            entry.match = Boolean(
                entry.offchainHash && entry.onchainHash && entry.offchainHash === entry.onchainHash
            );
            results.push(entry);
        }

        const intact = results.filter(r => r.match).length;
        const tampered = results.filter(r => !r.match).length;

        res.json({
            ok: true,
            total: results.length,
            intact,
            tampered,
            details: results,
        });
    } catch (e) {
        next(e);
    }
});

export default router;
