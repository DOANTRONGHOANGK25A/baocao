#!/bin/bash

set -e

NETWORK_DIR="/home/hoang/Bao-cao-thuc-tap/network/fabric-samples/test-network"
CHAINCODE_DIR="/home/hoang/Bao-cao-thuc-tap/chaincode/hoso-chaincode"

CC_NAME="hoso"

echo "⚠️  CẢNH BÁO: Script này sẽ XÓA toàn bộ Fabric network!"
echo ""
read -p "Tiếp tục? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Đã hủy."
    exit 0
fi

echo ""
echo "Bước 0: Install chaincode dependencies..."
cd "$CHAINCODE_DIR"
#npm install --production
cd "$NETWORK_DIR"

echo ""
echo "Bước 1: Dọn dẹp network cũ..."
./network.sh down

echo ""
echo "Bước 2: Khởi động network + tạo channel (có CA)..."
./network.sh up createChannel -ca

echo ""
echo "Bước 3: Deploy chaincode '$CC_NAME' (standard lifecycle)..."
./network.sh deployCC -ccn "$CC_NAME" -ccp "$CHAINCODE_DIR" -ccl javascript

echo ""
echo "HOÀN TẤT! Fabric network đang chạy + chaincode '$CC_NAME' đã deploy."
echo ""
echo "Kiểm tra nhanh:"
echo "   docker ps | grep dev-peer"
