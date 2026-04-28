import React, { useState, useEffect } from "react";
import {
    Card, Typography, Divider, Descriptions, Tag, Button, Space, Spin,
    Table, message, Modal, Input, Image, Empty, Timeline, Alert, Upload, Popconfirm,
} from "antd";
import {
    ArrowLeftOutlined, SafetyCertificateOutlined, StopOutlined,
    CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined,
    FilePdfOutlined, FileImageOutlined,
    LinkOutlined, ExclamationCircleOutlined, SendOutlined, WalletOutlined,
    UploadOutlined, InboxOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { getRecordById, getRecordFiles, downloadRecordFile, submitRecord, approveRecord, rejectRecord, revokeRecord, getChainLogs } from "../api/records";
import { verifyOnChain } from "../api/public";
import "../styles/pages.css";

const { Title, Text } = Typography;

const statusConfig = {
    DRAFT: { color: "default", text: "Nháp" },
    PENDING: { color: "processing", text: "Chờ duyệt" },
    CONFIRMED: { color: "success", icon: <CheckCircleOutlined />, text: "Đã xác nhận" },
    REJECTED: { color: "warning", icon: <ExclamationCircleOutlined />, text: "Bị từ chối" },
    REVOKED: { color: "error", icon: <CloseCircleOutlined />, text: "Đã thu hồi" },
};

export function RecordDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [files, setFiles] = useState([]);
    const [chainLogs, setChainLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [revokeModal, setRevokeModal] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const [approveModal, setApproveModal] = useState(false);
    const [revokeReason, setRevokeReason] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [walletFile, setWalletFile] = useState(null);
    const [fileUrls, setFileUrls] = useState({});
    const [verifyData, setVerifyData] = useState(null);
    const [verifying, setVerifying] = useState(false);

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role;

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [rRecord, rFiles, rLogs] = await Promise.all([
                getRecordById(id),
                getRecordFiles(id),
                getChainLogs(id).catch(() => ({ data: [] })),
            ]);
            if (rRecord?.ok) setRecord(rRecord.data);
            if (rFiles?.ok) setFiles(rFiles.data || []);
            setChainLogs(rLogs?.data || []);

            // Tải preview cho file ảnh
            if (rFiles?.ok && rFiles.data) {
                const urls = {};
                for (const f of rFiles.data) {
                    if (f.mime_type?.startsWith("image/")) {
                        try {
                            const blob = await downloadRecordFile(id, f.id);
                            urls[f.id] = URL.createObjectURL(blob);
                        } catch { /* skip */ }
                    }
                }
                setFileUrls(urls);
            }
        } catch (e) {
            console.error(e);
            message.error("Lỗi khi tải chi tiết hồ sơ");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        return () => {
            Object.values(fileUrls).forEach(url => URL.revokeObjectURL(url));
        };
    }, [id]);

    // STAFF gửi duyệt
    const handleSubmit = async () => {
        setActionLoading(true);
        try {
            const res = await submitRecord(id);
            if (res?.ok) {
                message.success("Đã gửi hồ sơ chờ duyệt!");
                fetchAll();
            }
        } catch (e) {
            message.error(e.response?.data?.message || "Lỗi gửi duyệt");
        } finally {
            setActionLoading(false);
        }
    };

    // Đọc file wallet JSON từ file upload
    const readWalletFile = () => {
        return new Promise((resolve, reject) => {
            if (!walletFile) return reject(new Error("Chưa chọn file ví"));
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch {
                    reject(new Error("File ví không hợp lệ"));
                }
            };
            reader.onerror = () => reject(new Error("Không thể đọc file"));
            reader.readAsText(walletFile);
        });
    };

    // MANAGER duyệt
    const handleApprove = async () => {
        if (!walletFile) {
            message.warning("Vui lòng chọn file ví danh tính!");
            return;
        }
        setActionLoading(true);
        try {
            const walletData = await readWalletFile();
            const res = await approveRecord(id, walletData);
            if (res?.ok) {
                message.success("Đã duyệt hồ sơ và ghi lên blockchain!");
                setApproveModal(false);
                setWalletFile(null);
                fetchAll();
            }
        } catch (e) {
            message.error(e.response?.data?.message || e.message || "Lỗi duyệt hồ sơ");
        } finally {
            setActionLoading(false);
        }
    };

    // MANAGER từ chối
    const handleReject = async () => {
        setActionLoading(true);
        try {
            const res = await rejectRecord(id, rejectReason);
            if (res?.ok) {
                message.warning("Đã từ chối hồ sơ");
                setRejectModal(false);
                setRejectReason("");
                fetchAll();
            }
        } catch (e) {
            message.error(e.response?.data?.message || "Lỗi từ chối");
        } finally {
            setActionLoading(false);
        }
    };

    // MANAGER thu hồi
    const handleRevoke = async () => {
        if (!walletFile) {
            message.warning("Vui lòng chọn file ví danh tính!");
            return;
        }
        setActionLoading(true);
        try {
            const walletData = await readWalletFile();
            const res = await revokeRecord(id, revokeReason, walletData);
            if (res?.ok) {
                message.warning("Đã thu hồi hồ sơ");
                setRevokeModal(false);
                setRevokeReason("");
                setWalletFile(null);
                fetchAll();
            }
        } catch (e) {
            message.error(e.response?.data?.message || e.message || "Lỗi thu hồi");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadFile = async (fileId, filename) => {
        try {
            let url = fileUrls[fileId];
            if (!url) {
                const blob = await downloadRecordFile(id, fileId);
                url = URL.createObjectURL(blob);
            }
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || "file";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            message.error("Lỗi tải file");
        }
    };

    if (loading) {
        return (
            <div className="page-container" style={{ textAlign: "center", paddingTop: 80 }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!record) {
        return (
            <div className="page-container">
                <Empty description="Không tìm thấy hồ sơ" />
                <Button onClick={() => navigate("/records")}>Quay lại</Button>
            </div>
        );
    }

    const cfg = statusConfig[record.status] || statusConfig.DRAFT;

    const fileColumns = [
        { title: "Tên file", dataIndex: "filename", ellipsis: true },
        {
            title: "Loại", dataIndex: "mime_type", width: 120,
            render: (t) => t?.includes("pdf") ? <Tag color="red"><FilePdfOutlined /> PDF</Tag> : <Tag color="blue"><FileImageOutlined /> Ảnh</Tag>,
        },
        {
            title: "Kích thước", dataIndex: "size_bytes", width: 100,
            render: (s) => s ? `${(s / 1024).toFixed(1)} KB` : "—",
        },
        {
            title: "", width: 80, align: "center",
            render: (_, row) => (
                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); handleDownloadFile(row.id, row.filename); }}>
                    Tải
                </Button>
            ),
        },
    ];

    const chainColumns = [
        { title: "Hành động", dataIndex: "action", width: 120, render: (a) => a === "CONFIRM" ? <Tag color="green">Xác nhận</Tag> : <Tag color="red">Thu hồi</Tag> },
        { title: "TxID", dataIndex: "tx_id", ellipsis: true, render: (t) => t ? <Text code copyable={{ text: t }} style={{ fontSize: 11 }}>{t.substring(0, 20)}...</Text> : "—" },
        { title: "Record Hash", dataIndex: "record_hash", ellipsis: true, render: (t) => t ? <Text code style={{ fontSize: 10 }}>{t.substring(0, 16)}...</Text> : "—" },
        { title: "Thời gian", dataIndex: "created_at", width: 160, render: (d) => d ? new Date(d).toLocaleString("vi-VN") : "—" },
    ];

    return (
        <div className="page-container">
            <Space style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/records")}>Quay lại</Button>
            </Space>

            <Card>
                <Descriptions title="Thông tin hồ sơ" bordered column={{ xs: 1, sm: 2 }} size="small">
                    <Descriptions.Item label="Mã hồ sơ"><Text strong copyable>{record.record_code}</Text></Descriptions.Item>
                    <Descriptions.Item label="Trạng thái"><Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Tên hồ sơ" span={2}>{record.title}</Descriptions.Item>
                    <Descriptions.Item label="Loại">{record.category || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Người liên quan">{record.owner_name || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{record.created_at ? new Date(record.created_at).toLocaleString("vi-VN") : "—"}</Descriptions.Item>
                    <Descriptions.Item label="Cập nhật">{record.updated_at ? new Date(record.updated_at).toLocaleString("vi-VN") : "—"}</Descriptions.Item>
                    <Descriptions.Item label="Mô tả" span={2}>{record.description || "—"}</Descriptions.Item>
                    {record.revoke_reason && <Descriptions.Item label="Lý do từ chối/thu hồi" span={2}><Text type="danger">{record.revoke_reason}</Text></Descriptions.Item>}
                </Descriptions>
            </Card>

            {/* Hành động theo vai trò */}
            <Card style={{ marginTop: 16 }}>
                <Space>
                    {/* STAFF: gửi duyệt khi DRAFT hoặc REJECTED */}
                    {role === "STAFF" && (record.status === "DRAFT" || record.status === "REJECTED") && (
                        <>
                            <Popconfirm title="Gửi duyệt hồ sơ?" onConfirm={handleSubmit} okText="Gửi" cancelText="Hủy">
                                <Button type="primary" icon={<SendOutlined />} loading={actionLoading} size="large">
                                    Gửi duyệt
                                </Button>
                            </Popconfirm>
                            <Button onClick={() => navigate(`/create`, { state: { recordId: record.id } })}>Chỉnh sửa</Button>
                        </>
                    )}

                    {/* MANAGER: duyệt / từ chối khi PENDING */}
                    {role === "MANAGER" && record.status === "PENDING" && (
                        <>
                            <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => { setWalletFile(null); setApproveModal(true); }} loading={actionLoading} size="large">
                                Duyệt & ghi blockchain
                            </Button>
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModal(true)} loading={actionLoading} size="large">
                                Từ chối
                            </Button>
                        </>
                    )}

                    {/* MANAGER: thu hồi khi CONFIRMED */}
                    {role === "MANAGER" && record.status === "CONFIRMED" && (
                        <Button danger icon={<StopOutlined />} onClick={() => { setWalletFile(null); setRevokeModal(true); }} loading={actionLoading} size="large">
                            Thu hồi
                        </Button>
                    )}
                </Space>
            </Card>

            {/* File đính kèm */}
            <Divider orientation="left">File đính kèm ({files.length})</Divider>

            {files.length > 0 ? (
                <>
                    <Table rowKey="id" columns={fileColumns} dataSource={files} pagination={false} size="small" style={{ marginBottom: 16 }} />

                    {/* Preview ảnh */}
                    {Object.keys(fileUrls).length > 0 && (
                        <Card size="small" title="Xem trước ảnh" style={{ marginTop: 8 }}>
                            <Image.PreviewGroup>
                                <Space wrap>
                                    {files.filter(f => fileUrls[f.id]).map(f => (
                                        <Image
                                            key={f.id}
                                            width={150}
                                            src={fileUrls[f.id]}
                                            style={{ borderRadius: 4, border: "1px solid #f0f0f0" }}
                                            placeholder={<Spin />}
                                        />
                                    ))}
                                </Space>
                            </Image.PreviewGroup>
                        </Card>
                    )}
                </>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có file đính kèm" />
            )}

            {/* Xác thực blockchain */}
            {(record.status === "CONFIRMED" || record.status === "REVOKED") && (
                <>
                    <Divider orientation="left">
                        <Space><LinkOutlined />Xác thực Blockchain</Space>
                    </Divider>
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button
                                type="primary"
                                icon={<SafetyCertificateOutlined />}
                                loading={verifying}
                                onClick={async () => {
                                    setVerifying(true);
                                    try {
                                        const res = await verifyOnChain(record.record_code);
                                        if (res.ok) setVerifyData(res);
                                        else message.error(res.message || "Lỗi xác thực");
                                    } catch (e) {
                                        message.error("Không thể kết nối blockchain");
                                    } finally {
                                        setVerifying(false);
                                    }
                                }}
                            >
                                Xác thực dữ liệu trên Blockchain
                            </Button>

                            {verifyData && (
                                <div style={{ marginTop: 12 }}>
                                    {!verifyData.onchain?.exists ? (
                                        <Alert type="warning" showIcon message="Hồ sơ chưa được ghi lên blockchain" />
                                    ) : (
                                        <>
                                            <Alert
                                                type={verifyData.match ? "success" : "error"}
                                                showIcon
                                                icon={verifyData.match ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                                                message={verifyData.match ? "Dữ liệu toàn vẹn — Hash khớp với blockchain" : "Dữ liệu KHÔNG toàn vẹn — Hash không khớp"}
                                                style={{ marginBottom: 12 }}
                                            />
                                            <Descriptions bordered size="small" column={1}>
                                                <Descriptions.Item label="Hash (On-chain)">
                                                    <Text code copyable={{ text: verifyData.onchain.recordHash }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                                        {verifyData.onchain.recordHash}
                                                    </Text>
                                                </Descriptions.Item>
                                                <Descriptions.Item label="Hash (Tính toán)">
                                                    <Text code copyable={{ text: verifyData.computedRecordHash }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                                        {verifyData.computedRecordHash || "—"}
                                                    </Text>
                                                </Descriptions.Item>
                                                <Descriptions.Item label="Transaction ID">
                                                    <Text code copyable={{ text: verifyData.onchain.txId }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                                        {verifyData.onchain.txId || "—"}
                                                    </Text>
                                                </Descriptions.Item>
                                            </Descriptions>
                                        </>
                                    )}
                                </div>
                            )}
                        </Space>
                    </Card>
                </>
            )}

            {/* Chain logs — Timeline */}
            {chainLogs.length > 0 && (
                <>
                    <Divider orientation="left">Nhật ký blockchain ({chainLogs.length})</Divider>
                    <Timeline
                        items={chainLogs.map((log) => ({
                            color: log.action === 'CONFIRM' ? 'green' : 'red',
                            dot: log.action === 'CONFIRM'
                                ? <CheckCircleOutlined style={{ fontSize: 16 }} />
                                : <CloseCircleOutlined style={{ fontSize: 16 }} />,
                            children: (
                                <div>
                                    <div style={{ marginBottom: 4 }}>
                                        <Tag color={log.action === 'CONFIRM' ? 'green' : 'red'}>
                                            {log.action === 'CONFIRM' ? 'Xác nhận' : 'Thu hồi'}
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '—'}
                                        </Text>
                                    </div>
                                    {log.tx_id && (
                                        <div style={{ fontSize: 11, marginBottom: 2 }}>
                                            <Text type="secondary">TxID: </Text>
                                            <Text code copyable={{ text: log.tx_id }} style={{ fontSize: 10 }}>
                                                {log.tx_id.substring(0, 24)}...
                                            </Text>
                                        </div>
                                    )}
                                    {log.record_hash && (
                                        <div style={{ fontSize: 11 }}>
                                            <Text type="secondary">Hash: </Text>
                                            <Text code style={{ fontSize: 10 }}>
                                                {log.record_hash.substring(0, 20)}...
                                            </Text>
                                        </div>
                                    )}
                                </div>
                            ),
                        }))}
                    />
                </>
            )}

            {/* Modal duyệt — upload wallet */}
            <Modal
                title={<><WalletOutlined /> Duyệt hồ sơ & ký blockchain</>}
                open={approveModal}
                onOk={handleApprove}
                onCancel={() => { setApproveModal(false); setWalletFile(null); }}
                okText="Xác nhận duyệt"
                cancelText="Hủy"
                okButtonProps={{ disabled: !walletFile }}
                confirmLoading={actionLoading}
            >
                <p>Duyệt hồ sơ <b>{record.record_code}</b> và ghi lên blockchain.</p>
                <Alert
                    type="info"
                    showIcon
                    message="Chọn file ví danh tính (wallet-xxx.json) để ký giao dịch"
                    style={{ marginBottom: 16 }}
                />
                <Upload.Dragger
                    accept=".json"
                    maxCount={1}
                    beforeUpload={(file) => {
                        setWalletFile(file);
                        return false;
                    }}
                    onRemove={() => setWalletFile(null)}
                    fileList={walletFile ? [walletFile] : []}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">Kéo thả hoặc nhấn để chọn file ví</p>
                    <p className="ant-upload-hint">Chỉ chấp nhận file .json</p>
                </Upload.Dragger>
            </Modal>

            {/* Modal từ chối */}
            <Modal
                title="Từ chối hồ sơ"
                open={rejectModal}
                onOk={handleReject}
                onCancel={() => { setRejectModal(false); setRejectReason(""); }}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                confirmLoading={actionLoading}
            >
                <p>Nhập lý do từ chối hồ sơ <b>{record.record_code}</b>:</p>
                <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Lý do từ chối..." />
            </Modal>

            {/* Modal thu hồi — upload wallet */}
            <Modal
                title={<><WalletOutlined /> Thu hồi hồ sơ</>}
                open={revokeModal}
                onOk={handleRevoke}
                onCancel={() => { setRevokeModal(false); setRevokeReason(""); setWalletFile(null); }}
                okText="Xác nhận thu hồi"
                cancelText="Hủy"
                okButtonProps={{ danger: true, disabled: !walletFile }}
                confirmLoading={actionLoading}
            >
                <p>Nhập lý do thu hồi hồ sơ <b>{record.record_code}</b>:</p>
                <Input.TextArea rows={3} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Lý do thu hồi..." style={{ marginBottom: 16 }} />
                <Alert
                    type="info"
                    showIcon
                    message="Chọn file ví danh tính để ký giao dịch thu hồi"
                    style={{ marginBottom: 12 }}
                />
                <Upload.Dragger
                    accept=".json"
                    maxCount={1}
                    beforeUpload={(file) => {
                        setWalletFile(file);
                        return false;
                    }}
                    onRemove={() => setWalletFile(null)}
                    fileList={walletFile ? [walletFile] : []}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">Kéo thả hoặc nhấn để chọn file ví</p>
                    <p className="ant-upload-hint">Chỉ chấp nhận file .json</p>
                </Upload.Dragger>
            </Modal>
        </div>
    );
}
