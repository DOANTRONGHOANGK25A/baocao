import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import * as grpc from "@grpc/grpc-js";
import { connect, signers } from "@hyperledger/fabric-gateway";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let defaultGateway;

function readFirstFileInDir(dir) {
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    if (files.length === 0) throw new Error(`No key file in ${dir}`);
    return fs.readFileSync(path.join(dir, files[0]));
}

function newGrpcConnection() {
    const tlsCert = fs.readFileSync(process.env.FABRIC_TLS_CERT_PATH);
    const creds = grpc.credentials.createSsl(tlsCert);

    return new grpc.Client(process.env.FABRIC_PEER_ENDPOINT, creds, {
        "grpc.ssl_target_name_override": process.env.FABRIC_PEER_HOST_ALIAS,
        "grpc.default_authority": process.env.FABRIC_PEER_HOST_ALIAS,
    });
}

// Gateway mặc định (Admin identity) — dùng cho query, health check
function getDefaultGateway() {
    if (defaultGateway) return defaultGateway;

    const client = newGrpcConnection();
    const certPem = fs.readFileSync(process.env.FABRIC_CERT_PATH);
    const keyPem = readFirstFileInDir(process.env.FABRIC_KEY_DIR);
    const privateKey = crypto.createPrivateKey(keyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    defaultGateway = connect({
        client,
        identity: { mspId: process.env.FABRIC_MSPID, credentials: certPem },
        signer,
    });

    return defaultGateway;
}

// Contract mặc định (Admin) — cho query, health check
export function getContract() {
    const gw = getDefaultGateway();
    const network = gw.getNetwork(process.env.FABRIC_CHANNEL);
    return network.getContract(process.env.FABRIC_CHAINCODE);
}

/**
 * Tạo contract tạm thời từ credentials upload lên.
 * MANAGER upload wallet JSON → backend dùng cert+key để ký transaction → xong bỏ.
 */
export function getContractWithCredentials(certPem, privateKeyPem) {
    const client = newGrpcConnection();
    const certBuffer = Buffer.from(certPem);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    const gw = connect({
        client,
        identity: { mspId: process.env.FABRIC_MSPID, credentials: certBuffer },
        signer,
    });

    const network = gw.getNetwork(process.env.FABRIC_CHANNEL);
    return network.getContract(process.env.FABRIC_CHAINCODE);
}
