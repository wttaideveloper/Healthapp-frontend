import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthAge Admin",
  description: "Admin dashboard for HealthAge workspace entitlements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
