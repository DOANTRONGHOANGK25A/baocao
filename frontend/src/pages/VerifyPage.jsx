import React, { useState } from "react";
import {
    Card, Input, Typography, Space, Divider, Empty, Spin, Tag, Table, Select,
    Drawer, Descriptions, Button, message, Alert, Row, Col, Image, List,
} from "antd";
import {
    SearchOutlined, SafetyCertificateOutlined, CheckCircleOutlined,
    CloseCircleOutlined, InfoCircleOutlined, DownloadOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import { searchRecords, verifyOnChain, getPublicRecordFiles, downloadPublicRecordFile } from "../api/public";
import "../styles/pages.css";

const { Title, Text } = Typography;

const searchTypes = [
    { value: "recordCode", label: "Mã hồ sơ" },
    { value: "ownerName", label: "Người liên quan" },
    { value: "title", label: "Tên hồ sơ" },
];

export function VerifyPage() {
    const [loading, setLoading] = useState(false);
    const [searchType, setSearchType] = useState("recordCode");
    const [results, setResults] = useState(null);

    const [selected, setSelected] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [verifying, setVerifying] = useState(false);
    const [verifyData, setVerifyData] = useState(null);

    const [files, setFiles] = useState([]);
    const [fileUrls, setFileUrls] = useState({});
    const [loadingFiles, setLoadingFiles] = useState(false);

    const handleSearch = async (value) => {
        if (!value.trim()) return;
        setLoading(true);
        try {
            const res = await searchRecords(searchType, value.trim());
            setResults(res.ok ? res.results : []);
        } catch (e) {
            console.error(e);
            message.error("Lỗi khi tra cứu");
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (record) => {
        setSelected(record);
        setVerifyData(null);
        setDrawerOpen(true);
        await fetchFiles(record.id);
    };

    const fetchFiles = async (recordId) => {
        setLoadingFiles(true);
        try {
            const res = await getPublicRecordFiles(recordId);
            const fileList = res?.data || [];
            setFiles(fileList);

            const urls = {};
            for (const f of fileList) {
                if (f.mime_type?.startsWith("image/")) {
                    try {
                        const blob = await downloadPublicRecordFile(recordId, f.id);
                        urls[f.id] = URL.createObjectURL(blob);
                    } catch { /* skip */ }
                }
            }
            setFileUrls(urls);
        } catch (e) {
            console.error("Error fetching files", e);
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleDownloadFile = async (fileId, fileName) => {
        if (!selected) return;
        try {
            let url = fileUrls[fileId];
            if (!url) {
                const blob = await downloadPublicRecordFile(selected.id, fileId);
                url = URL.createObjectURL(blob);
            }
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName || "file");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            message.error("Lỗi khi tải file");
        }
    };

    const handleVerify = async () => {
        if (!selected) return;
        setVerifying(true);
        try {
            const res = await verifyOnChain(selected.recordCode);
            if (res.ok) {
                setVerifyData(res);
            } else {
                message.error(res.message || "Lỗi xác thực");
            }
        } catch (e) {
            console.error(e);
            message.error("Không thể kết nối blockchain");
        } finally {
            setVerifying(false);
        }
    };

    const columns = [
        {
            title: "Mã hồ sơ",
            dataIndex: "recordCode",
            render: (t) => <Text strong copyable>{t}</Text>,
            width: 170,
        },
        {
            title: "Tên hồ sơ",
            dataIndex: "title",
            ellipsis: true,
        },
        {
            title: "Người liên quan",
            dataIndex: "ownerName",
            ellipsis: true,
            render: (t) => t || "—",
        },
        {
            title: "Loại",
            dataIndex: "category",
            width: 120,
            render: (t) => t ? <Tag>{t}</Tag> : "—",
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            width: 130,
            align: "center",
            render: (s) => {
                const config = {
                    CONFIRMED: { color: "success", icon: <CheckCircleOutlined />, text: "Đã xác nhận" },
                    REVOKED: { color: "error", icon: <CloseCircleOutlined />, text: "Đã thu hồi" },
                };
                const { color, icon, text } = config[s] || { color: "default", text: s };
                return <Tag color={color} icon={icon}>{text}</Tag>;
            },
        },
        {
            title: "",
            width: 100,
            align: "center",
            render: (_, row) => (
                <Button type="link" size="small" onClick={() => openDetail(row)} icon={<SearchOutlined />}>
                    Chi tiết
                </Button>
            ),
        },
    ];

    const renderMatchTag = () => {
        if (!verifyData) return null;
        if (!verifyData.onchain.exists) {
            return <Tag icon={<InfoCircleOutlined />} color="default">CHƯA GHI BLOCKCHAIN</Tag>;
        }
        return verifyData.match
            ? <Tag icon={<CheckCircleOutlined />} color="success">Hợp lệ — Dữ liệu toàn vẹn</Tag>
            : <Tag icon={<CloseCircleOutlined />} color="error">Không hợp lệ — Dữ liệu bị thay đổi</Tag>;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-icon verify-icon">
                    <SafetyCertificateOutlined />
                </div>
                <div className="page-header-content">
                    <Title level={3} className="page-title">Tra cứu hồ sơ</Title>
                    <Text type="secondary">Tra cứu và xác thực dữ liệu qua blockchain</Text>
                </div>
            </div>

            <Divider />

            <Card className="search-card">
                <Space.Compact style={{ width: "100%" }}>
                    <Select value={searchType} onChange={setSearchType} options={searchTypes} style={{ width: 180 }} />
                    <Input.Search
                        placeholder="Nhập từ khóa tra cứu..."
                        enterButton={<Space><SearchOutlined /><span>Tra cứu</span></Space>}
                        onSearch={handleSearch}
                        loading={loading}
                        size="large"
                    />
                </Space.Compact>
            </Card>

            <div style={{ marginTop: 24 }}>
                {loading ? (
                    <Card><div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /><div style={{ marginTop: 16 }}><Text type="secondary">Đang tra cứu...</Text></div></div></Card>
                ) : results === null ? (
                    <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">Nhập từ khóa để bắt đầu tra cứu</Text>} /></Card>
                ) : results.length === 0 ? (
                    <Card>
                        <div style={{ textAlign: "center", padding: 40 }}>
                            <CloseCircleOutlined style={{ fontSize: 48, color: "#ff4d4f" }} />
                            <Title level={4} style={{ margin: "16px 0 8px" }}>Không tìm thấy kết quả</Title>
                            <Text type="secondary">Không có hồ sơ nào khớp với từ khóa tra cứu.</Text>
                        </div>
                    </Card>
                ) : (
                    <Card title={`Kết quả tra cứu (${results.length})`}>
                        <Table
                            rowKey="recordCode"
                            columns={columns}
                            dataSource={results}
                            pagination={false}
                            size="middle"
                            onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: "pointer" } })}
                        />
                    </Card>
                )}
            </div>

            <Drawer
                title={<Space><SafetyCertificateOutlined /><span>Chi tiết hồ sơ</span></Space>}
                width="90%"
                style={{ maxWidth: 1000 }}
                open={drawerOpen}
                onClose={() => {
                    setDrawerOpen(false);
                    Object.values(fileUrls).forEach(url => URL.revokeObjectURL(url));
                    setFileUrls({});
                    setFiles([]);
                }}
            >
                {selected && (
                    <>
                        <Descriptions title="Thông tin hồ sơ" bordered column={1} size="small">
                            <Descriptions.Item label="Mã hồ sơ"><Text strong>{selected.recordCode}</Text></Descriptions.Item>
                            <Descriptions.Item label="Tên hồ sơ">{selected.title}</Descriptions.Item>
                            <Descriptions.Item label="Loại">{selected.category || "—"}</Descriptions.Item>
                            <Descriptions.Item label="Người liên quan">{selected.ownerName || "—"}</Descriptions.Item>
                            <Descriptions.Item label="Mô tả">{selected.description || "—"}</Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <Tag color={selected.status === "CONFIRMED" ? "success" : "error"}>
                                    {selected.status === "CONFIRMED" ? "Đã xác nhận" : "Đã thu hồi"}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Files */}
                        <Divider orientation="left">Tài liệu đính kèm</Divider>
                        {loadingFiles ? (
                            <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
                        ) : files.length > 0 ? (
                            <>
                                <List
                                    size="small"
                                    dataSource={files}
                                    renderItem={(f) => (
                                        <List.Item
                                            actions={[
                                                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadFile(f.id, f.filename)}>Tải</Button>
                                            ]}
                                        >
                                            <List.Item.Meta
                                                avatar={f.mime_type?.includes("pdf") ? <FileTextOutlined style={{ fontSize: 20, color: "#ff4d4f" }} /> : <FileTextOutlined style={{ fontSize: 20, color: "#1890ff" }} />}
                                                title={f.filename}
                                                description={f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : ""}
                                            />
                                        </List.Item>
                                    )}
                                />
                                {Object.keys(fileUrls).length > 0 && (
                                    <Card size="small" style={{ marginTop: 12 }}>
                                        <Image.PreviewGroup>
                                            <Space wrap>
                                                {files.filter(f => fileUrls[f.id]).map(f => (
                                                    <Image key={f.id} width={120} src={fileUrls[f.id]} style={{ borderRadius: 4, border: "1px solid #f0f0f0" }} />
                                                ))}
                                            </Space>
                                        </Image.PreviewGroup>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có file" />
                        )}

                        <Divider />

                        <Space style={{ marginBottom: 16 }}>
                            <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={handleVerify} loading={verifying} size="large">
                                Xác thực trên blockchain
                            </Button>
                        </Space>

                        {verifying && <div style={{ textAlign: "center", marginTop: 24 }}><Spin tip="Đang truy vấn blockchain..." /></div>}

                        {verifyData && !verifying && (
                            <div style={{ marginTop: 16 }}>
                                <Card
                                    size="small"
                                    style={{
                                        textAlign: "center", marginBottom: 16,
                                        background: !verifyData.onchain.exists ? "#fafafa" : verifyData.match ? "#f6ffed" : "#fff2e8",
                                        borderColor: !verifyData.onchain.exists ? "#d9d9d9" : verifyData.match ? "#b7eb8f" : "#ffbb96",
                                    }}
                                >
                                    <div style={{ fontSize: 18, fontWeight: "bold" }}>{renderMatchTag()}</div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {!verifyData.onchain.exists
                                            ? "Hồ sơ chưa được ghi lên blockchain"
                                            : verifyData.match
                                                ? "Dữ liệu khớp với blockchain — Hồ sơ hợp lệ"
                                                : "Dữ liệu không khớp — Có thể bị giả mạo"}
                                    </Text>
                                </Card>

                                {!verifyData.onchain.exists ? (
                                    <Alert type="warning" showIcon message="Chưa ghi trên blockchain" description="Hồ sơ này chưa được xác nhận lên blockchain." />
                                ) : (
                                    <>
                                        <Divider orientation="left" style={{ fontSize: 12 }}>Thông tin kỹ thuật</Divider>
                                        <Descriptions column={1} bordered size="small">
                                            <Descriptions.Item label="Trạng thái on-chain">
                                                <Tag color={verifyData.onchain.status === "CONFIRMED" ? "success" : "error"}>
                                                    {verifyData.onchain.status === "CONFIRMED" ? "Đã xác nhận" : "Đã thu hồi"}
                                                </Tag>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Hash (On-chain)">
                                                <Text code copyable={{ text: verifyData.onchain.recordHash }} style={{ fontSize: 10, wordBreak: "break-all" }}>
                                                    {verifyData.onchain.recordHash}
                                                </Text>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Hash (Tính toán)">
                                                <Text code copyable={{ text: verifyData.computedRecordHash }} style={{ fontSize: 10, wordBreak: "break-all" }}>
                                                    {verifyData.computedRecordHash || "—"}
                                                </Text>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Thời gian xác nhận">
                                                {verifyData.onchain.confirmedAt ? new Date(verifyData.onchain.confirmedAt).toLocaleString("vi-VN") : "—"}
                                            </Descriptions.Item>
                                            {verifyData.onchain.revokedAt && (
                                                <Descriptions.Item label="Thời gian thu hồi">
                                                    {new Date(verifyData.onchain.revokedAt).toLocaleString("vi-VN")}
                                                </Descriptions.Item>
                                            )}
                                            <Descriptions.Item label="Transaction ID">
                                                <Text code copyable={{ text: verifyData.onchain.txId }} style={{ fontSize: 10, wordBreak: "break-all" }}>
                                                    {verifyData.onchain.txId || "—"}
                                                </Text>
                                            </Descriptions.Item>
                                        </Descriptions>
                                    </>
                                )}

                                {verifyData.onchain.exists && verifyData.offchainStatus !== verifyData.onchain.status && (
                                    <Alert
                                        style={{ marginTop: 16 }}
                                        type="warning"
                                        showIcon
                                        message="Trạng thái không đồng bộ"
                                        description={`Off-chain: ${verifyData.offchainStatus}, On-chain: ${verifyData.onchain.status}`}
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}
            </Drawer>
        </div>
    );
}
