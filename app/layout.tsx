import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialFlowAI",
  description: "An AI LinkedIn content assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white min-h-screen font-sans text-gray-900">
        {children}
      </body>
    </html>
  );
}
