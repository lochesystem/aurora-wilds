import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.GITHUB_PAGES === "true"
    ? "https://lochesystem.github.io/aurora-ascent/"
    : "http://localhost:3000/");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aurora Wilds — Sobrevivência procedural 3D",
  description: "Explore um mundo procedural sem bordas, encontre alimento e reúna recursos para sobreviver.",
  icons: { icon: "favicon.svg", shortcut: "favicon.svg" },
  openGraph: {
    title: "Aurora Wilds — Sobrevivência procedural 3D",
    description: "Um mundo infinito por chunks. Explore, colete e sobreviva.",
    images: [{ url: "og.png", width: 1792, height: 922, alt: "Aurora Wilds" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurora Wilds — Sobrevivência procedural 3D",
    description: "Um mundo infinito por chunks. Explore, colete e sobreviva.",
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
