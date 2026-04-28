import React from "react";
import { RouterProvider } from "react-router-dom";
import router from "../router";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";

export default function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Card: {
            headerBg: "#fafafa",
          },
          Table: {
            headerBg: "#fafafa",
          },
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
