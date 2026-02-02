import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * public/ に置くファイル（今のあなたの構成でOK）
 * - public/icon-mofu.png
 * - public/apple-touch-icon.png
 */

export const metadata: Metadata = {
  title: {
    default: "みやむLog",
    template: "%s | みやむLog",
  },
  description: "作業時間をサクッと記録して、月次で振り返る個人用ログアプリ。",
  applicationName: "みやむLog",

  icons: {
    // ブラウザタブ（favicon相当）
    icon: [{ url: "/icon-mofu.png", type: "image/png" }],
    // iPhoneホーム画面用
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
