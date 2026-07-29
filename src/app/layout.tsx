import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DisclaimerModal } from "@/components/layout/DisclaimerModal";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Governor Lab 秋田",
  description:
    "価値観の重み付けから施策パッケージを導く思考実験と、47都道府県の財政・産業構造の比較。公的統計に基づく非公式の教育用アプリです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DisclaimerModal />
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
