import crypto from "crypto";
import { pool } from "../src/db.js";

export function sha256Hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function normStr(x) {
    if (x === null || x === undefined) return "";
    return x.toString().normalize("NFC").trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
}



/**
 * Xây dựng văn bản chuẩn hóa (canonical text) từ các trường thông tin hồ sơ
 * và mã băm SHA-256 của các file đính kèm.
 *
 * Thứ tự các trường là CỐ ĐỊNH:
 *   recordCode, title, category, ownerName, description,
 *   file0Sha256, file1Sha256, ...
 *
 * @param {object} fields  – chứa các trường hồ sơ
 * @param {string[]} fileSha256List – danh sách SHA-256 của file (sorted by id ASC)
 * @returns {string} các dòng nối bằng LF
 */
export function buildCanonicalText(fields, fileSha256List = []) {
    const lines = [
        `recordCode=${normStr(fields.recordCode)}`,
        `title=${normStr(fields.title)}`,
        `category=${normStr(fields.category)}`,
        `ownerName=${normStr(fields.ownerName)}`,
        `description=${normStr(fields.description)}`,
    ];

    fileSha256List.forEach((hash, i) => {
        lines.push(`file${i}Sha256=${hash}`);
    });

    return lines.join("\n");
}

/** sha256( utf-8( canonicalText ) ) → chuỗi hex in thường */
export function computeRecordHash(canonicalText) {
    return sha256Hex(Buffer.from(canonicalText, "utf8"));
}

/* ── Điểm vào chính: đọc DB + files → sinh recordHash ── */

export async function computeRecordHashByRecordId(id) {
    const d = await pool.query("SELECT * FROM records WHERE id=$1", [id]);
    const row = d.rows[0];
    if (!row) throw new Error("RECORD_NOT_FOUND");

    const f = await pool.query(
        "SELECT id, data FROM record_files WHERE record_id=$1 ORDER BY id ASC",
        [id]
    );

    const fileSha256List = f.rows.map(x => sha256Hex(x.data));

    const canonicalText = buildCanonicalText({
        recordCode: row.record_code,
        title: row.title,
        category: row.category,
        ownerName: row.owner_name,
        description: row.description,
    }, fileSha256List);

    const recordHash = computeRecordHash(canonicalText);
    return { recordHash, canonicalText };
}
