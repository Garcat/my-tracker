import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "运单追踪 | My Tracker",
  description: "批量查询运单状态，并同步共享追踪列表。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
