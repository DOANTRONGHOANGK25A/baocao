import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Space, Tag, Typography, Divider, Modal, Form, Input, Select, message, Tooltip, Popconfirm, Spin } from "antd";
import {
    UserOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    KeyOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser } from "../api/users";
import "../styles/pages.css";

const { Title, Text } = Typography;

const roleColors = {
    ADMIN: "red",
    STAFF: "blue",
    MANAGER: "green",
};

const roleLabels = {
    ADMIN: "Quản trị viên",
    STAFF: "Nhân viên",
    MANAGER: "Quản lý",
};

export function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState();
    const [selectedUser, setSelectedUser] = useState(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [resetForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const userStr = localStorage.getItem("user");
    const currentUser = userStr ? JSON.parse(userStr) : null;

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await listUsers();
            if (res.ok) {
                setUsers(res.data);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Không thể tải danh sách người dùng";
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = () => {
        createForm.resetFields();
        setIsCreateModalOpen(true);
    };

    const handleCreateSubmit = async (values) => {
        setSubmitting(true);
        try {
            const res = await createUser({
                username: values.username,
                password: values.password,
                role: values.role,
            });

            if (res.ok) {
                message.success("Tạo người dùng thành công!");
                setIsCreateModalOpen(false);
                createForm.resetFields();
                await fetchUsers();
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Tạo người dùng thất bại";
            message.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = (record) => {
        setSelectedUser(record);
        editForm.setFieldsValue({
            username: record.username,
            role: record.role,
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (values) => {
        if (!selectedUser) return;

        setSubmitting(true);
        try {
            const res = await updateUser(selectedUser.id, {
                username: values.username,
                role: values.role,
            });

            if (res.ok) {
                message.success("Cập nhật người dùng thành công!");
                setIsEditModalOpen(false);
                setSelectedUser(null);
                await fetchUsers();
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Cập nhật người dùng thất bại";
            message.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenResetPassword = (record) => {
        setSelectedUser(record);
        resetForm.resetFields();
        setIsResetModalOpen(true);
    };

    const handleResetPasswordSubmit = async (values) => {
        if (!selectedUser) return;

        setSubmitting(true);
        try {
            const res = await resetUserPassword(selectedUser.id, values.newPassword);

            if (res.ok) {
                message.success("Đặt lại mật khẩu thành công!");
                setIsResetModalOpen(false);
                setSelectedUser(null);
                resetForm.resetFields();
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Đặt lại mật khẩu thất bại";
            message.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (record) => {
        setSubmitting(true);
        try {
            const res = await deleteUser(record.id);
            if (res.ok) {
                message.success("Xóa người dùng thành công!");
                await fetchUsers();
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Xóa người dùng thất bại";
            message.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return users.filter((user) => {
            const matchKeyword = !keyword || user.username.toLowerCase().includes(keyword);
            const matchRole = !roleFilter || user.role === roleFilter;
            return matchKeyword && matchRole;
        });
    }, [users, searchText, roleFilter]);

    const roleStats = useMemo(() => {
        return users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});
    }, [users]);

    const isCurrentUser = (record) => record.id === currentUser?.id;

    const actionDisabledReason = (record) => {
        if (!isCurrentUser(record)) return null;
        return "Dùng phần thông tin tài khoản hoặc đổi mật khẩu cho tài khoản đang đăng nhập";
    };

    const columns = [
        {
            title: "ID",
            dataIndex: "id",
            width: 60,
        },
        {
            title: "Tên đăng nhập",
            dataIndex: "username",
            render: (_, record) => <Text strong>{record.username}</Text>,
        },
        {
            title: "Vai trò",
            dataIndex: "role",
            render: (role) => (
                <Tag color={roleColors[role]}>{roleLabels[role] || role}</Tag>
            ),
        },
        {
            title: "Ngày tạo",
            dataIndex: "created_at",
            render: (date) => new Date(date).toLocaleDateString("vi-VN"),
        },
        {
            title: "Hành động",
            width: 150,
            align: "center",
            render: (_, record) => (
                <Space>
                    <Tooltip title={actionDisabledReason(record) || "Chỉnh sửa"}>
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            disabled={Boolean(actionDisabledReason(record)) || submitting}
                            onClick={() => handleOpenEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title={actionDisabledReason(record) || "Đặt lại mật khẩu"}>
                        <Button
                            type="text"
                            icon={<KeyOutlined rotate={315} />}
                            disabled={Boolean(actionDisabledReason(record)) || submitting}
                            onClick={() => handleOpenResetPassword(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xác nhận xóa"
                        description="Bạn có chắc muốn xóa người dùng này?"
                        onConfirm={() => handleDelete(record)}
                        disabled={Boolean(actionDisabledReason(record)) || submitting}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title={actionDisabledReason(record) || "Xóa"}>
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={Boolean(actionDisabledReason(record)) || submitting}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-icon admin-icon">
                    <UserOutlined />
                </div>
                <div className="page-header-content">
                    <Title level={3} className="page-title">Quản lý người dùng</Title>
                    <Text type="secondary">
                        Quản lý tài khoản người dùng và phân quyền trong hệ thống
                    </Text>
                </div>
            </div>

            <Divider />

            <Card className="table-card">
                <div className="table-header">
                    <Space wrap>
                        <Text>Tổng số: <Text strong>{filteredUsers.length}</Text> / {users.length} người dùng</Text>
                        {Object.entries(roleStats).map(([role, count]) => (
                            <Tag key={role} color={roleColors[role]}>
                                {roleLabels[role] || role}: {count}
                            </Tag>
                        ))}
                    </Space>
                    <Space>
                        <Input
                            allowClear
                            placeholder="Tìm theo tên đăng nhập"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 220 }}
                        />
                        <Select
                            allowClear
                            placeholder="Lọc vai trò"
                            value={roleFilter}
                            onChange={setRoleFilter}
                            style={{ width: 180 }}
                            options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
                        />
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchUsers}
                            loading={loading}
                        >
                            Làm mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreate}
                        >
                            Thêm người dùng
                        </Button>
                    </Space>
                </div>

                <Spin spinning={loading}>
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={filteredUsers}
                        pagination={{
                            pageSize: 8,
                            showTotal: (total) => `Tổng ${total} người dùng`,
                        }}
                        className="data-table"
                    />
                </Spin>
            </Card>

            <Modal
                title={
                    <Space>
                        <UserOutlined />
                        <span>Thêm người dùng mới</span>
                    </Space>
                }
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                footer={null}
                width={500}
                destroyOnHidden
            >
                <Form
                    form={createForm}
                    layout="vertical"
                    onFinish={handleCreateSubmit}
                    style={{ marginTop: 24 }}
                >
                    <Form.Item
                        label="Tên đăng nhập"
                        name="username"
                        rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập" }]}
                    >
                        <Input placeholder="Nhập tên đăng nhập" />
                    </Form.Item>

                    <Form.Item
                        label="Vai trò"
                        name="role"
                        rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
                    >
                        <Select
                            placeholder="Chọn vai trò"
                            options={[
                                { value: "ADMIN", label: "Quản trị viên" },
                                { value: "STAFF", label: "Nhân viên" },
                                { value: "MANAGER", label: "Quản lý" },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Mật khẩu"
                        name="password"
                        rules={[
                            { required: true, message: "Vui lòng nhập mật khẩu" },
                            { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
                        ]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu" />
                    </Form.Item>

                    <div className="modal-actions">
                        <Button onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Tạo người dùng
                        </Button>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={
                    <Space>
                        <EditOutlined />
                        <span>Chỉnh sửa người dùng</span>
                    </Space>
                }
                open={isEditModalOpen}
                onCancel={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                }}
                footer={null}
                width={500}
                destroyOnHidden
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleEditSubmit}
                    style={{ marginTop: 24 }}
                >
                    <Form.Item
                        label="Tên đăng nhập"
                        name="username"
                        rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập" }]}
                    >
                        <Input placeholder="Nhập tên đăng nhập" />
                    </Form.Item>

                    <Form.Item
                        label="Vai trò"
                        name="role"
                        rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
                    >
                        <Select
                            placeholder="Chọn vai trò"
                            options={[
                                { value: "ADMIN", label: "Quản trị viên" },
                                { value: "STAFF", label: "Nhân viên" },
                                { value: "MANAGER", label: "Quản lý" },
                            ]}
                        />
                    </Form.Item>

                    <div className="modal-actions">
                        <Button
                            onClick={() => {
                                setIsEditModalOpen(false);
                                setSelectedUser(null);
                            }}
                        >
                            Hủy
                        </Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Lưu thay đổi
                        </Button>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={
                    <Space>
                        <KeyOutlined rotate={315} />
                        <span>Đặt lại mật khẩu</span>
                    </Space>
                }
                open={isResetModalOpen}
                onCancel={() => {
                    setIsResetModalOpen(false);
                    setSelectedUser(null);
                }}
                footer={null}
                width={500}
                destroyOnHidden
            >
                <Form
                    form={resetForm}
                    layout="vertical"
                    onFinish={handleResetPasswordSubmit}
                    style={{ marginTop: 24 }}
                >
                    <Form.Item>
                        <Text type="secondary">
                            Đặt mật khẩu mới cho tài khoản <Text strong>{selectedUser?.username}</Text>
                        </Text>
                    </Form.Item>

                    <Form.Item
                        label="Mật khẩu mới"
                        name="newPassword"
                        rules={[
                            { required: true, message: "Vui lòng nhập mật khẩu mới" },
                            { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
                        ]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu mới" />
                    </Form.Item>

                    <Form.Item
                        label="Xác nhận mật khẩu"
                        name="confirmPassword"
                        dependencies={["newPassword"]}
                        rules={[
                            { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("newPassword") === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Nhập lại mật khẩu mới" />
                    </Form.Item>

                    <div className="modal-actions">
                        <Button
                            onClick={() => {
                                setIsResetModalOpen(false);
                                setSelectedUser(null);
                            }}
                        >
                            Hủy
                        </Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Cập nhật mật khẩu
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
