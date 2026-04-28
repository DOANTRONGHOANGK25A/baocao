import React, { useState, useEffect } from "react";
import {
    Card, Form, Input, Select, Upload, Button, Typography, Divider,
    Space, message, Spin, Image, Modal,
} from "antd";
import {
    PlusCircleOutlined, EditOutlined, UploadOutlined, SaveOutlined,
    ArrowLeftOutlined, EyeOutlined, DeleteOutlined, FileImageOutlined,
    FilePdfOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { createRecord, updateRecord, getRecordById, getRecordFiles, downloadRecordFile } from "../api/records";

import "../styles/pages.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CATEGORIES = [
    "Hợp đồng",
    "Chứng chỉ",
    "Quyết định",
    "Biên bản",
    "Giấy xác nhận",
    "Khác",
];

export function RecordCreatePage() {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingFileUrls, setExistingFileUrls] = useState({});
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState("");
    const [previewTitle, setPreviewTitle] = useState("");
    const [removedExistingIds, setRemovedExistingIds] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    // Nếu có recordId từ state → chế độ chỉnh sửa
    const editRecordId = location.state?.recordId || null;
    const isEdit = !!editRecordId;

    // Load dữ liệu record khi ở chế độ chỉnh sửa
    useEffect(() => {
        if (!isEdit) return;

        const loadRecord = async () => {
            setInitialLoading(true);
            try {
                const [rRecord, rFiles] = await Promise.all([
                    getRecordById(editRecordId),
                    getRecordFiles(editRecordId).catch(() => ({ ok: false, data: [] })),
                ]);

                if (rRecord?.ok && rRecord.data) {
                    const r = rRecord.data;
                    form.setFieldsValue({
                        recordCode: r.record_code,
                        title: r.title,
                        category: r.category || undefined,
                        ownerName: r.owner_name || "",
                        description: r.description || "",
                    });
                }

                if (rFiles?.ok && rFiles.data) {
                    setExistingFiles(rFiles.data);

                    // Tải preview cho file ảnh hiện có
                    const urls = {};
                    for (const f of rFiles.data) {
                        if (f.mime_type?.startsWith("image/")) {
                            try {
                                const blob = await downloadRecordFile(editRecordId, f.id);
                                urls[f.id] = URL.createObjectURL(blob);
                            } catch { /* skip */ }
                        }
                    }
                    setExistingFileUrls(urls);
                }
            } catch (e) {
                console.error("Load record error:", e);
                message.error("Lỗi khi tải dữ liệu hồ sơ");
            } finally {
                setInitialLoading(false);
            }
        };

        loadRecord();

        return () => {
            // Cleanup blob URLs khi unmount
            Object.values(existingFileUrls).forEach(url => URL.revokeObjectURL(url));
        };
    }, [editRecordId, isEdit]);

    // Preview file mới upload
    const getBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });

    const handlePreviewNew = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewTitle(file.name || file.url?.substring(file.url.lastIndexOf("/") + 1));
        setPreviewOpen(true);
    };

    const handlePreviewExisting = (file) => {
        const url = existingFileUrls[file.id];
        if (url) {
            setPreviewImage(url);
            setPreviewTitle(file.filename);
            setPreviewOpen(true);
        } else {
            message.info("Không thể xem trước file này (chỉ hỗ trợ ảnh)");
        }
    };

    const handleRemoveExisting = (fileId) => {
        setRemovedExistingIds(prev => [...prev, fileId]);
        setExistingFiles(prev => prev.filter(f => f.id !== fileId));
        if (existingFileUrls[fileId]) {
            URL.revokeObjectURL(existingFileUrls[fileId]);
            setExistingFileUrls(prev => {
                const next = { ...prev };
                delete next[fileId];
                return next;
            });
        }
    };

    const handleSubmit = async (values) => {
        // Ở chế độ tạo mới: bắt buộc phải có file
        if (!isEdit && fileList.length === 0) {
            message.warning("Vui lòng tải lên ít nhất 1 file đính kèm");
            return;
        }

        setLoading(true);
        try {
            const formData = {
                recordCode: values.recordCode,
                title: values.title,
                category: values.category || "",
                ownerName: values.ownerName || "",
                description: values.description || "",
            };

            const files = fileList.map(f => f.originFileObj || f);

            if (isEdit) {
                const res = await updateRecord(editRecordId, formData, files);
                if (res.ok) {
                    message.success("Cập nhật hồ sơ thành công!");
                    navigate(`/records/${editRecordId}`);
                }
            } else {
                const res = await createRecord(formData, files);
                if (res.ok) {
                    message.success("Tạo hồ sơ thành công!");
                    navigate("/records");
                }
            }
        } catch (e) {
            console.error("Submit error:", e);
            const msg = e.response?.data?.message || (isEdit ? "Lỗi khi cập nhật hồ sơ" : "Lỗi khi tạo hồ sơ");
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="page-container" style={{ textAlign: "center", paddingTop: 80 }}>
                <Spin size="large" tip="Đang tải dữ liệu hồ sơ..." />
            </div>
        );
    }

    // Danh sách file hiện có (chưa bị xóa) để hiển thị dạng grid preview
    const visibleExistingFiles = existingFiles.filter(f => !removedExistingIds.includes(f.id));

    return (
        <div className="page-container">
            <div className="page-header">
                <div className={`page-header-icon ${isEdit ? "edit-icon" : "create-icon"}`}>
                    {isEdit ? <EditOutlined /> : <PlusCircleOutlined />}
                </div>
                <div className="page-header-content">
                    <Title level={3} className="page-title">
                        {isEdit ? "Chỉnh sửa hồ sơ" : "Tạo hồ sơ mới"}
                    </Title>
                    <Text type="secondary">
                        {isEdit
                            ? "Chỉnh sửa thông tin và file đính kèm của hồ sơ"
                            : "Nhập thông tin và tải lên file đính kèm để tạo hồ sơ"}
                    </Text>
                </div>
            </div>

            <Divider />

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    autoComplete="off"
                >
                    <Form.Item
                        name="recordCode"
                        label="Mã hồ sơ"
                        rules={[{ required: true, message: "Vui lòng nhập mã hồ sơ" }]}
                        extra="Ví dụ: HS-20260421-001"
                    >
                        <Input placeholder="Nhập mã hồ sơ" maxLength={50} disabled={isEdit} />
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label="Tên hồ sơ"
                        rules={[{ required: true, message: "Vui lòng nhập tên hồ sơ" }]}
                    >
                        <Input placeholder="Nhập tên hồ sơ" maxLength={200} />
                    </Form.Item>

                    <Form.Item name="category" label="Loại hồ sơ">
                        <Select placeholder="Chọn loại hồ sơ" allowClear>
                            {CATEGORIES.map(c => (
                                <Select.Option key={c} value={c}>{c}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="ownerName" label="Người/tổ chức liên quan">
                        <Input placeholder="Nhập tên người hoặc tổ chức" maxLength={100} />
                    </Form.Item>

                    <Form.Item name="description" label="Mô tả">
                        <TextArea rows={3} placeholder="Mô tả ngắn về hồ sơ" maxLength={500} showCount />
                    </Form.Item>

                    <Divider orientation="left">File đính kèm</Divider>

                    {/* Preview file hiện có khi chỉnh sửa */}
                    {isEdit && visibleExistingFiles.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <Text strong style={{ display: "block", marginBottom: 12 }}>File hiện có:</Text>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                {visibleExistingFiles.map(f => {
                                    const isImage = f.mime_type?.startsWith("image/");
                                    const previewUrl = existingFileUrls[f.id];

                                    return (
                                        <div
                                            key={f.id}
                                            style={{
                                                position: "relative",
                                                width: 120,
                                                height: 120,
                                                border: "1px solid #d9d9d9",
                                                borderRadius: 8,
                                                overflow: "hidden",
                                                background: "#fafafa",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            {/* Thumbnail */}
                                            {isImage && previewUrl ? (
                                                <img
                                                    src={previewUrl}
                                                    alt={f.filename}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ textAlign: "center", padding: 8 }}>
                                                    <FilePdfOutlined style={{ fontSize: 32, color: "#ff4d4f" }} />
                                                    <div style={{
                                                        fontSize: 11,
                                                        marginTop: 4,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        maxWidth: 100,
                                                    }}>
                                                        {f.filename}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hover overlay */}
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    background: "rgba(0,0,0,0.45)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 12,
                                                    opacity: 0,
                                                    transition: "opacity 0.2s",
                                                    cursor: "pointer",
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                            >
                                                {isImage && previewUrl && (
                                                    <EyeOutlined
                                                        style={{ color: "#fff", fontSize: 18 }}
                                                        onClick={() => handlePreviewExisting(f)}
                                                    />
                                                )}
                                                <DeleteOutlined
                                                    style={{ color: "#ff4d4f", fontSize: 18 }}
                                                    onClick={() => handleRemoveExisting(f.id)}
                                                />
                                            </div>

                                            {/* Tên file */}
                                            <div style={{
                                                position: "absolute",
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: "rgba(0,0,0,0.55)",
                                                color: "#fff",
                                                fontSize: 10,
                                                padding: "2px 6px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                textAlign: "center",
                                            }}>
                                                {f.filename}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                                Di chuột vào ảnh để xem/xóa. Tải file mới sẽ thêm vào danh sách.
                            </Text>
                        </div>
                    )}

                    {/* Upload file mới — dạng picture-card có preview */}
                    <Form.Item
                        label={isEdit ? "Tải thêm file mới" : "Tải lên file (tối đa 5 file, JPG/PNG/PDF, mỗi file ≤ 5MB)"}
                        required={!isEdit && fileList.length === 0}
                    >
                        <Upload
                            listType="picture-card"
                            multiple
                            maxCount={5}
                            accept=".jpg,.jpeg,.png,.pdf"
                            fileList={fileList}
                            beforeUpload={() => false}
                            onChange={({ fileList: newList }) => setFileList(newList)}
                            onPreview={handlePreviewNew}
                            onRemove={(file) => setFileList(prev => prev.filter(f => f.uid !== file.uid))}
                        >
                            {fileList.length < 5 && (
                                <div>
                                    <UploadOutlined style={{ fontSize: 20 }} />
                                    <div style={{ marginTop: 8, fontSize: 12 }}>Chọn file</div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24 }}>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SaveOutlined />}
                                loading={loading}
                                size="large"
                            >
                                {isEdit ? "Lưu thay đổi" : "Tạo hồ sơ"}
                            </Button>
                            <Button
                                onClick={() => navigate(isEdit ? `/records/${editRecordId}` : "/records")}
                                size="large"
                                icon={<ArrowLeftOutlined />}
                            >
                                Hủy
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            {/* Modal preview ảnh */}
            <Modal
                open={previewOpen}
                title={previewTitle}
                footer={null}
                onCancel={() => setPreviewOpen(false)}
                width={720}
            >
                <img alt={previewTitle} style={{ width: "100%" }} src={previewImage} />
            </Modal>
        </div>
    );
}
