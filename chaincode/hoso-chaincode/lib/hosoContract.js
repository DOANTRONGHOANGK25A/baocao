"use strict";

const { Contract } = require("fabric-contract-api");

class HosoContract extends Contract {

    /** Đảm bảo key tồn tại */
    async ensureCode(ctx, recordCode) {
        const raw = await ctx.stub.getState(recordCode);
        if (!raw || raw.length === 0) return null;
        return JSON.parse(raw.toString());
    }

    /**
     * ConfirmRecord — ghi xác nhận hồ sơ lên blockchain
     * @param {string} recordCode  – mã hồ sơ
     * @param {string} jsonData    – JSON chứa { recordHash, status, confirmedAt }
     */
    async ConfirmRecord(ctx, recordCode, jsonData) {
        const existing = await this.ensureCode(ctx, recordCode);
        if (existing) {
            throw new Error(`Hồ sơ ${recordCode} đã tồn tại trên blockchain`);
        }

        const data = JSON.parse(jsonData);
        if (!data.recordHash) throw new Error("Thiếu recordHash");

        const txId = ctx.stub.getTxID();

        const record = {
            recordCode,
            recordHash: data.recordHash,
            status: "CONFIRMED",
            confirmedAt: data.confirmedAt || new Date().toISOString(),
            revokedAt: null,
            txId,
        };

        await ctx.stub.putState(recordCode, Buffer.from(JSON.stringify(record)));
        return record;
    }

    /**
     * RevokeRecord — thu hồi hồ sơ
     * @param {string} recordCode – mã hồ sơ
     * @param {string} revokedAt  – thời gian thu hồi ISO
     */
    async RevokeRecord(ctx, recordCode, revokedAt) {
        const existing = await this.ensureCode(ctx, recordCode);
        if (!existing) {
            throw new Error(`Hồ sơ ${recordCode} không tồn tại trên blockchain`);
        }
        if (existing.status !== "CONFIRMED") {
            throw new Error(`Hồ sơ ${recordCode} không ở trạng thái CONFIRMED (hiện tại: ${existing.status})`);
        }

        existing.status = "REVOKED";
        existing.revokedAt = revokedAt || new Date().toISOString();
        existing.txId = ctx.stub.getTxID();

        await ctx.stub.putState(recordCode, Buffer.from(JSON.stringify(existing)));
        return existing;
    }

    /**
     * QueryRecord — tra cứu hồ sơ
     * @param {string} recordCode – mã hồ sơ
     */
    async QueryRecord(ctx, recordCode) {
        const existing = await this.ensureCode(ctx, recordCode);
        if (!existing) {
            throw new Error(`Hồ sơ ${recordCode} không tồn tại trên blockchain`);
        }
        return existing;
    }
}

module.exports = HosoContract;
