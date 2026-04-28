import React, { useState, useEffect } from "react";
import { Card, Statistic, Row, Col, Table, Tag, Spin, Space, Typography } from "antd";
import {
    FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined,
    LinkOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getDashboardStats } from "../api/dashboard";
import "../styles/pages.css";

const { Title } = Typography;

const statusMap = {
    DRAFT: { color: "default", text: "Nháp" },
    PENDING: { color: "processing", text: "Chờ duyệt" },
    CONFIRMED: { color: "success", text: "Đã xác nhận" },
    REJECTED: { color: "warning", text: "Bị từ chối" },
    REVOKED: { color: "error", text: "Đã thu hồi" },
};

export function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        getDashboardStats()
            .then(res => { if (res?.ok) setStats(res.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-container" style={{ textAlign: "center", paddingTop: 80 }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!stats) return null;

    const r = stats.records;

    const columns = [
        { title: "Mã hồ sơ", dataIndex: "record_code", render: (t, row) => <a onClick={() => navigate(`/records/${row.id}`)}>{t}</a> },
        { title: "Tên hồ sơ", dataIndex: "title", ellipsis: true },
        {
            title: "Trạng thái", dataIndex: "status", width: 120,
            render: (s) => { const c = statusMap[s] || statusMap.DRAFT; return <Tag color={c.color}>{c.text}</Tag>; },
        },
        { title: "Ngày tạo", dataIndex: "created_at", width: 160, render: (d) => d ? new Date(d).toLocaleString("vi-VN") : "—" },
    ];

    return (
        <div className="page-container">
            <Title level={3} style={{ marginBottom: 24 }}>Tổng quan hệ thống</Title>

            <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Tổng hồ sơ"
                            value={Number(r.total)}
                            prefix={<FileTextOutlined />}
                            valueStyle={{ color: "#1890ff" }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Chờ duyệt"
                            value={Number(r.pending)}
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: "#faad14" }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Đã xác nhận"
                            value={Number(r.confirmed)}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: "#52c41a" }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Giao dịch blockchain"
                            value={stats.totalChainTx}
                            prefix={<LinkOutlined />}
                            valueStyle={{ color: "#722ed1" }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Hồ sơ mới nhất" style={{ marginTop: 24 }}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={stats.recentRecords}
                    pagination={false}
                    size="small"
                />
            </Card>
        </div>
    );
}
