import React, { useState, useEffect } from "react";
import { Layout, Menu, Avatar, Dropdown, Space, Button, theme, Modal, Input, Form, message, Descriptions, Tag } from "antd";
import {
    SearchOutlined,
    FileTextOutlined,
    PlusCircleOutlined,
    UserOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LogoutOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
    DashboardOutlined,
    AuditOutlined,
    WalletOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { createWallet } from "../api/wallet";
import "../styles/layout.css";

const { Header, Content, Sider } = Layout;

const roleLabels = {
    ADMIN: "Quản trị viên",
    STAFF: "Nhân viên",
    MANAGER: "Quản lý",
};

const menuItems = [
    {
        key: "/dashboard",
        icon: <DashboardOutlined />,
        label: "Tổng quan",
    },
    {
        key: "/verify",
        icon: <SearchOutlined />,
        label: "Tra cứu hồ sơ",
    },
    {
        key: "/records",
        icon: <FileTextOutlined />,
        label: "Danh sách hồ sơ",
    },
    {
        key: "/create",
        icon: <PlusCircleOutlined />,
        label: "Tạo hồ sơ",
    },
    {
        key: "/admin",
        icon: <UserOutlined />,
        label: "Quản lý người dùng",
    },
    {
        key: "/audit-logs",
        icon: <AuditOutlined />,
        label: "Nhật ký hệ thống",
    },
];

const userMenuItems = [
    {
        key: "profile",
        icon: <UserOutlined />,
        label: "Thông tin tài khoản",
    },
    {
        key: "change-password",
        icon: <LockOutlined />,
        label: "Đổi mật khẩu",
    },
    {
        type: "divider",
    },
    {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Đăng xuất",
        danger: true,
    },
];

export default function MainLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [pwdModalOpen, setPwdModalOpen] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [pwdForm] = Form.useForm();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role || "GUEST";

    // Chỉ track "đã tạo ví" trong localStorage — đơn giản cho demo
    const [walletCreated, setWalletCreated] = useState(() => {
        if (role === "MANAGER") {
            return localStorage.getItem("walletCreated") === "true";
        }
        return true;
    });
    const [createLoading, setCreateLoading] = useState(false);

    const getFilteredMenuItems = () => {
        if (!user) {
            return menuItems.filter(item => item.key === "/verify");
        }

        switch (role) {
            case "ADMIN":
                return menuItems.filter(item => ["/dashboard", "/verify", "/records", "/admin", "/audit-logs"].includes(item.key));
            case "STAFF":
                return menuItems.filter(item => ["/dashboard", "/verify", "/records", "/create", "/audit-logs"].includes(item.key));
            case "MANAGER":
                return menuItems.filter(item => ["/dashboard", "/verify", "/records", "/audit-logs"].includes(item.key));
            default:
                return menuItems.filter(item => item.key === "/verify");
        }
    };

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    const handleUserMenuClick = async ({ key }) => {
        if (key === "logout") {
            try {
                await api.post("/auth/logout");
            } catch (err) {
                console.error("Logout API failed", err);
            } finally {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
            }
        } else if (key === "change-password") {
            pwdForm.resetFields();
            setPwdModalOpen(true);
        } else if (key === "profile") {
            setProfileOpen(true);
        }
    };

    const handleChangePassword = async () => {
        try {
            const values = await pwdForm.validateFields();
            if (values.newPassword !== values.confirmPassword) {
                message.error("Mật khẩu xác nhận không khớp");
                return;
            }
            setPwdLoading(true);
            await api.put("/auth/change-password", {
                oldPassword: values.oldPassword,
                newPassword: values.newPassword,
            });
            message.success("Đổi mật khẩu thành công!");
            setPwdModalOpen(false);
        } catch (e) {
            const msg = e.response?.data?.message || "Lỗi đổi mật khẩu";
            message.error(msg);
        } finally {
            setPwdLoading(false);
        }
    };

    const handleCreateWallet = async () => {
        setCreateLoading(true);
        try {
            const res = await createWallet();
            if (res?.ok) {
                // Tải wallet.json về
                const blob = new Blob([JSON.stringify(res.wallet, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `wallet-${user.username}.json`;
                a.click();
                URL.revokeObjectURL(url);

                setWalletCreated(true);
                localStorage.setItem("walletCreated", "true");
                message.success("Tạo ví danh tính thành công! File wallet đã được tải về.");
            }
        } catch (e) {
            message.error(e.response?.data?.message || "Lỗi tạo ví danh tính");
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <Layout className="main-layout">
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                className="main-sider"
                width={260}
            >
                <div className="logo-container">
                    <div className="logo">
                        <div className="logo-icon">
                            <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />
                        </div>
                        {!collapsed && <span className="logo-text">Lưu trữ dữ liệu</span>}
                    </div>
                </div>

                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={getFilteredMenuItems()}
                    onClick={handleMenuClick}
                    className="main-menu"
                />

                <div className="sider-footer">
                    {!collapsed && (
                        <div className="version-info">
                            <small>Phiên bản 1.0.0</small>
                        </div>
                    )}
                </div>
            </Sider>

            <Layout className="content-layout">
                <Header className="main-header" style={{ background: colorBgContainer }}>
                    <div className="header-left">
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            className="collapse-btn"
                        />
                    </div>

                    <div className="header-right">
                        {user ? (
                            <>
                                {/* Nút tạo ví cho MANAGER — chỉ hiện khi chưa tạo */}
                                {role === "MANAGER" && !walletCreated && (
                                    <Button
                                        type="primary"
                                        icon={<WalletOutlined />}
                                        onClick={handleCreateWallet}
                                        loading={createLoading}
                                        style={{ marginRight: 12 }}
                                    >
                                        Tạo ví danh tính
                                    </Button>
                                )}
                                <div className="status-badge" style={{ marginRight: 16 }}>
                                    <span className="status-dot"></span>
                                    <span className="status-text">{roleLabels[role] || role}</span>
                                </div>
                                <Dropdown
                                    menu={{
                                        items: userMenuItems,
                                        onClick: handleUserMenuClick,
                                    }}
                                    placement="bottomRight"
                                    trigger={['click']}
                                >
                                    <Space className="user-dropdown">
                                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                                        <span className="user-name">{user.username || 'Người dùng'}</span>
                                    </Space>
                                </Dropdown>
                            </>
                        ) : (
                            <>
                                <div className="status-badge" style={{ marginRight: 16 }}>
                                    <span className="status-dot" style={{ backgroundColor: '#ccc' }}></span>
                                    <span className="status-text">Khách</span>
                                </div>
                                <Button type="primary" onClick={() => navigate('/login')}>
                                    Đăng nhập
                                </Button>
                            </>
                        )}
                    </div>
                </Header>

                <Content className="main-content">
                    <div
                        className="content-wrapper"
                        style={{
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        <Outlet />
                    </div>
                </Content>
            </Layout>

            <Modal
                title="Đổi mật khẩu"
                open={pwdModalOpen}
                onOk={handleChangePassword}
                onCancel={() => setPwdModalOpen(false)}
                okText="Xác nhận"
                cancelText="Hủy"
                confirmLoading={pwdLoading}
            >
                <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu hiện tại" />
                    </Form.Item>
                    <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, message: "Vui lòng nhập mật khẩu mới" }, { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label="Xác nhận mật khẩu mới" rules={[{ required: true, message: "Vui lòng xác nhận mật khẩu mới" }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Thông tin tài khoản"
                open={profileOpen}
                onCancel={() => setProfileOpen(false)}
                footer={<Button onClick={() => setProfileOpen(false)}>Đóng</Button>}
            >
                {user && (
                    <Descriptions bordered column={1} style={{ marginTop: 16 }}>
                        <Descriptions.Item label="Tên đăng nhập">{user.username}</Descriptions.Item>
                        <Descriptions.Item label="Mã người dùng">{user.id}</Descriptions.Item>
                        <Descriptions.Item label="Vai trò">
                            <Tag color="blue">{roleLabels[user.role] || user.role}</Tag>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </Layout>
    );
}
