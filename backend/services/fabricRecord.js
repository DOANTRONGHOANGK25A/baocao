import { getContract, getContractWithCredentials } from "./fabricClient.js";

function toJson(buf) {
    return JSON.parse(Buffer.from(buf).toString("utf8"));
}

// Đọc hồ sơ từ blockchain (dùng default identity)
export async function chainRead(recordCode) {
    const c = getContract();
    const out = await c.evaluateTransaction("QueryRecord", recordCode);
    return toJson(out);
}

/**
 * Xác nhận hồ sơ — MANAGER ký bằng credentials upload lên.
 * @param {string} recordCode
 * @param {object} data - { recordHash, status, confirmedAt }
 * @param {{ certificate: string, privateKey: string }} credentials
 */
export async function chainConfirm(recordCode, data, credentials) {
    const c = credentials
        ? getContractWithCredentials(credentials.certificate, credentials.privateKey)
        : getContract();
    const jsonData = JSON.stringify(data);
    const out = await c.submitTransaction("ConfirmRecord", recordCode, jsonData);
    return toJson(out);
}

/**
 * Thu hồi hồ sơ — MANAGER ký bằng credentials upload lên.
 * @param {string} recordCode
 * @param {string} revokedAtISO
 * @param {{ certificate: string, privateKey: string }} credentials
 */
export async function chainRevoke(recordCode, revokedAtISO, credentials) {
    const c = credentials
        ? getContractWithCredentials(credentials.certificate, credentials.privateKey)
        : getContract();
    const out = await c.submitTransaction("RevokeRecord", recordCode, revokedAtISO);
    return toJson(out);
}
