import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Exam",
  description: "A focused practice exam interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
