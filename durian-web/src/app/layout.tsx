import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Durian Online",
  description: "Durian 在线桌游原型",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
