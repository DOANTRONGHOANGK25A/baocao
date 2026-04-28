import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import RequireAuth from "../components/RequireAuth";
import { VerifyPage } from "../pages/VerifyPage";
import { RecordListPage } from "../pages/RecordListPage";
import { RecordDetailPage } from "../pages/RecordDetailPage";
import { RecordCreatePage } from "../pages/RecordCreatePage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AuditLogPage } from "../pages/AuditLogPage";
import { LoginPage } from "../pages/LoginPage";

const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginPage />,
    },
    {
        path: "/",
        element: <MainLayout />,
        children: [
            {
                index: true,
                element: <Navigate to="/verify" replace />,
            },
            {
                path: "verify",
                element: <VerifyPage />,
            },
            {
                element: <RequireAuth />,
                children: [
                    {
                        path: "dashboard",
                        element: <DashboardPage />,
                    },
                    {
                        path: "records",
                        element: <RecordListPage />,
                    },
                    {
                        path: "records/:id",
                        element: <RecordDetailPage />,
                    },
                    {
                        path: "create",
                        element: <RecordCreatePage />,
                    },
                    {
                        path: "audit-logs",
                        element: <AuditLogPage />,
                    },
                    {
                        element: <RequireAuth allowedRoles={["ADMIN"]} />,
                        children: [
                            {
                                path: "admin",
                                element: <AdminUsersPage />,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        path: "*",
        element: <Navigate to="/verify" replace />,
    },
]);

export default router;
