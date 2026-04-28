import FabricCAServices from "fabric-ca-client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const User = require("fabric-common/lib/User");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Đường dẫn CA TLS cert (org1)
const CA_TLS_CERT = path.resolve(
    __dirname,
    "../../network/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem"
);

function getCA() {
    const tlsCert = fs.readFileSync(CA_TLS_CERT);
    const caUrl = process.env.FABRIC_CA_URL || "https://localhost:7054";
    return new FabricCAServices(caUrl, {
        trustedRoots: [tlsCert],
        verify: false,
    }, "ca-org1");
}

// Enroll CA admin (admin/adminpw) → cache kết quả để dùng làm registrar
let _cachedCAAdmin = null;
async function getCAAdmin() {
    if (_cachedCAAdmin) return _cachedCAAdmin;

    const ca = getCA();
    const mspId = process.env.FABRIC_MSPID || "Org1MSP";

    // Enroll CA admin với credentials mặc định của test-network
    const enrollment = await ca.enroll({
        enrollmentID: "admin",
        enrollmentSecret: "adminpw",
    });

    // Tạo User instance từ kết quả enroll
    const adminUser = User.createUser(
        "admin", "adminpw", mspId,
        enrollment.certificate,
        enrollment.key.toBytes()
    );

    _cachedCAAdmin = adminUser;
    return adminUser;
}

/**
 * Enroll user với Fabric CA → trả wallet JSON để MANAGER tải về.
 * KHÔNG lưu cert/key trên server — user tự giữ.
 */
export async function enrollUser(username) {
    const ca = getCA();
    const adminUser = await getCAAdmin();
    const mspId = process.env.FABRIC_MSPID || "Org1MSP";

    // 1) Register user với CA (dùng CA admin làm registrar)
    let secret;
    try {
        secret = await ca.register({
            enrollmentID: username,
            role: "client",
            affiliation: "org1.department1",
        }, adminUser);
    } catch (e) {
        // Nếu đã register rồi thì bỏ qua, thử enroll lại
        if (!String(e.message).includes("already registered")) throw e;
        // Dùng enrollmentSecret mặc định
        secret = username + "pw";
    }

    // 2) Enroll → lấy cert + key
    const enrollment = await ca.enroll({
        enrollmentID: username,
        enrollmentSecret: secret,
    });

    // 3) Tạo wallet JSON để trả cho user tải về (KHÔNG lưu trên server)
    const wallet = {
        version: 1,
        mspId,
        type: "X.509",
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
    };

    return wallet;
}
