import React, { useState, useEffect } from "react";
import { Card, Table, Button, Space, Tag, Typography, Divider, Input, Statistic, Row, Col, message, Tooltip, Modal, Spin, Alert } from "antd";
import {
    FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined,
    EyeOutlined, PlusCircleOutlined, SearchOutlined,
    AuditOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listRecords } from "../api/records";
import { getIntegrityCheck } from "../api/blockchain";
import "../styles/pages.css";

const { Title, Text } = Typography;

const statusConfig = {
    DRAFT: { color: "default", text: "Nháp" },
    PENDING: { color: "processing", text: "Chờ duyệt" },
    CONFIRMED: { color: "success", icon: <CheckCircleOutlined />, text: "Đã xác nhận" },
    REJECTED: { color: "warning", icon: <ExclamationCircleOutlined />, text: "Bị từ chối" },
    REVOKED: { color: "error", icon: <CloseCircleOutlined />, text: "Đã thu hồi" },
};

export function RecordListPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState("");
    const pageSize = 20;
    const navigate = useNavigate();

    // Integrity check
    const [integrityModal, setIntegrityModal] = useState(false);
    const [integrityLoading, setIntegrityLoading] = useState(false);
    const [integrityResult, setIntegrityResult] = useState(null);
    const userStr = localStorage.getItem("user");
    const userRole = userStr ? JSON.parse(userStr)?.role : null;

    const fetchData = async (q = "", status = "", p = 1) => {
        setLoading(true);
        try {
            const res = await listRecords({ q, status, page: p, pageSize });
            if (res?.ok) {
                setData(res.data || []);
                setTotal(res.total || 0);
            }
        } catch (e) {
            console.error(e);
            message.error("Lỗi khi tải danh sách");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(searchText, filterStatus, page); }, [page, filterStatus]);

    const handleSearch = (value) => {
        setSearchText(value);
        setPage(1);
        fetchData(value, filterStatus, 1);
    };

    const handleStatusFilter = (status) => {
        setFilterStatus(status === filterStatus ? "" : status);
        setPage(1);
    };

    const columns = [
        {
            title: "Mã hồ sơ",
            dataIndex: "record_code",
            width: 160,
            render: (t) => <Text strong copyable>{t}</Text>,
        },
        {
            title: "Tên hồ sơ",
            dataIndex: "title",
            ellipsis: true,
        },
        {
            title: "Người liên quan",
            dataIndex: "owner_name",
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
                const cfg = statusConfig[s] || statusConfig.DRAFT;
                return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>;
            },
        },
        {
            title: "Ngày tạo",
            dataIndex: "created_at",
            width: 150,
            render: (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—",
        },
        {
            title: "",
            width: 80,
            align: "center",
            render: (_, row) => (
                <Tooltip title="Xem chi tiết">
                    <Button type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/records/${row.id}`); }} />
                </Tooltip>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-icon list-icon">
                    <FileTextOutlined />
                </div>
                <div className="page-header-content">
                    <Title level={3} className="page-title">Danh sách hồ sơ</Title>
                    <Text type="secondary">Quản lý tất cả hồ sơ trong hệ thống</Text>
                </div>
            </div>

            <Divider />

            {/* Status filter buttons */}
            <Space style={{ marginBottom: 16 }} wrap>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                    <Button
                        key={key}
                        type={filterStatus === key ? "primary" : "default"}
                        size="small"
                        icon={cfg.icon}
                        onClick={() => handleStatusFilter(key)}
                    >
                        {cfg.text}
                    </Button>
                ))}
                {filterStatus && (
                    <Button size="small" onClick={() => { setFilterStatus(""); setPage(1); fetchData(searchText, "", 1); }}>
                        Xóa bộ lọc
                    </Button>
                )}
            </Space>

            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <Input.Search
                        placeholder="Tìm theo mã, tên hồ sơ, người liên quan..."
                        onSearch={handleSearch}
                        style={{ maxWidth: 400 }}
                        allowClear
                        enterButton={<Space><SearchOutlined /><span>Tìm</span></Space>}
                    />
                    {userRole === "STAFF" && (
                        <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate("/create")}>
                            Tạo hồ sơ
                        </Button>
                    )}
                </div>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={data}
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: (p) => setPage(p),
                        showTotal: (t) => `Tổng ${t} hồ sơ`,
                    }}
                    onRow={(record) => ({
                        onClick: () => navigate(`/records/${record.id}`),
                        style: { cursor: "pointer" },
                    })}
                />
            </Card>

            {/* Integrity Check Modal (ADMIN only) */}
            {userRole === "ADMIN" && (
                <>
                    <Divider />
                    <Card size="small">
                        <Space>
                            <Button
                                icon={<AuditOutlined />}
                                onClick={async () => {
                                    setIntegrityModal(true);
                                    setIntegrityLoading(true);
                                    try {
                                        const res = await getIntegrityCheck();
                                        if (res?.ok) setIntegrityResult(res);
                                        else message.error("Lỗi kiểm tra");
                                    } catch (e) {
                                        message.error(e.response?.data?.message || "Lỗi kiểm tra toàn vẹn");
                                    } finally {
                                        setIntegrityLoading(false);
                                    }
                                }}
                            >
                                Kiểm tra toàn vẹn dữ liệu
                            </Button>
                        </Space>
                    </Card>

                    <Modal
                        title={<Space><AuditOutlined /><span>Kết quả kiểm tra toàn vẹn</span></Space>}
                        open={integrityModal}
                        onCancel={() => setIntegrityModal(false)}
                        footer={<Button onClick={() => setIntegrityModal(false)}>Đóng</Button>}
                        width={800}
                    >
                        {integrityLoading ? (
                            <div style={{ textAlign: 'center', padding: 48 }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 16 }}><Text type="secondary">Đang kiểm tra...</Text></div>
                            </div>
                        ) : integrityResult ? (
                            <>
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col span={8}><Statistic title="Tổng" value={integrityResult.total} /></Col>
                                    <Col span={8}><Statistic title="Toàn vẹn" value={integrityResult.intact} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Col>
                                    <Col span={8}><Statistic title="Bị thay đổi" value={integrityResult.tampered} valueStyle={{ color: integrityResult.tampered > 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
                                </Row>
                                {integrityResult.tampered === 0 ? (
                                    <Alert type="success" showIcon message="Tất cả hồ sơ đều toàn vẹn" style={{ marginBottom: 16 }} />
                                ) : (
                                    <Alert type="error" showIcon message={`Phát hiện ${integrityResult.tampered} hồ sơ bị thay đổi!`} style={{ marginBottom: 16 }} />
                                )}
                                <Table
                                    rowKey="recordCode" size="small" pagination={false} scroll={{ y: 300 }}
                                    dataSource={integrityResult.details}
                                    columns={[
                                        { title: 'Mã hồ sơ', dataIndex: 'recordCode', width: 150 },
                                        { title: 'Kết quả', dataIndex: 'match', width: 120, render: m => m ? <Tag color="success">Toàn vẹn</Tag> : <Tag color="error">Bị thay đổi</Tag> },
                                        { title: 'Hash Off-chain', dataIndex: 'offchainHash', ellipsis: true, render: t => t ? <Text code style={{ fontSize: 9 }}>{t.substring(0, 16)}...</Text> : '—' },
                                        { title: 'Hash On-chain', dataIndex: 'onchainHash', ellipsis: true, render: t => t ? <Text code style={{ fontSize: 9 }}>{t.substring(0, 16)}...</Text> : '—' },
                                    ]}
                                />
                            </>
                        ) : null}
                    </Modal>
                </>
            )}
        </div>
    );
}
