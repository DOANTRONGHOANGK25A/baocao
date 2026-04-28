import React, { useState, useEffect } from "react";
import { Table, Typography, Spin, Tag } from "antd";
import { getAuditLogs } from "../api/auditLogs";
import "../styles/pages.css";

const { Title } = Typography;

const actionColors = {
    CREATE_RECORD: "green",
    EDIT_RECORD: "cyan",
    SUBMIT_RECORD: "orange",
    APPROVE_RECORD: "lime",
    REJECT_RECORD: "volcano",
    REVOKE_RECORD: "red",
    CREATE_USER: "purple",
    ENROLL_WALLET: "geekblue",
};

const actionLabels = {
    CREATE_RECORD: "Tạo hồ sơ",
    EDIT_RECORD: "Sửa hồ sơ",
    SUBMIT_RECORD: "Gửi duyệt",
    APPROVE_RECORD: "Duyệt hồ sơ",
    REJECT_RECORD: "Từ chối",
    REVOKE_RECORD: "Thu hồi",
    CREATE_USER: "Tạo user",
    ENROLL_WALLET: "Tạo ví",
};

export function AuditLogPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const fetchData = (p = 1) => {
        setLoading(true);
        getAuditLogs({ page: p, pageSize })
            .then(res => {
                if (res?.ok) {
                    setData(res.data);
                    setTotal(res.total);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(page); }, [page]);

    const columns = [
        {
            title: "Thời gian", dataIndex: "created_at", width: 170,
            render: (d) => d ? new Date(d).toLocaleString("vi-VN") : "—",
        },
        { title: "Người dùng", dataIndex: "username", width: 130 },
        {
            title: "Hành động", dataIndex: "action", width: 140,
            render: (a) => <Tag color={actionColors[a] || "default"}>{actionLabels[a] || a}</Tag>,
        },
        { title: "Chi tiết", dataIndex: "detail", ellipsis: true },
    ];

    return (
        <div className="page-container">
            <Title level={3} style={{ marginBottom: 24 }}>Nhật ký hệ thống</Title>

            <Table
                rowKey="id"
                columns={columns}
                dataSource={data}
                loading={loading}
                size="small"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: (p) => setPage(p),
                    showTotal: (t) => `Tổng ${t} bản ghi`,
                }}
            />
        </div>
    );
}
