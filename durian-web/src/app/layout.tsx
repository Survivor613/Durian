import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Durian Online — 猩猩水果店派对桌游",
  description: "2–7 人浏览器在线派对桌游：看别人的库存，猜自己的牌，下订单并在正确时机敲铃。",
  icons: {
    icon: "/assets/branding/gorilla-manager-seal-v1.png",
    apple: "/assets/branding/gorilla-manager-seal-v1.png",
  },
  openGraph: {
    images: ["/assets/branding/gorilla-manager-seal-v1.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
