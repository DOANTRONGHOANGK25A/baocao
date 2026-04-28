import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin } from "antd";
import api from "../api/api";

export default function RequireAuth({ allowedRoles }) {
    const [status, setStatus] = useState("loading"); // loading | ok | fail
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { setStatus("fail"); return; }

        api.get("/auth/me")
            .then(res => {
                const u = res.data.data.user;
                setUser(u);
                localStorage.setItem("user", JSON.stringify(u));
                setStatus("ok");
            })
            .catch(() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                setStatus("fail");
            });
    }, []);

    if (status === "loading") return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 120 }} />;
    if (status === "fail") return <Navigate to="/login" state={{ from: location }} replace />;

    if (allowedRoles?.length && (!user || !allowedRoles.includes(user.role))) {
        return <Navigate to="/verify" replace />;
    }

    return <Outlet />;
}
