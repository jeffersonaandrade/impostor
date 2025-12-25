import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Impostor - Jogo de Mistério",
  description: "Um jogo social de dedução e mistério",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className} suppressHydrationWarning={true}>
        {/* Background Image Wrapper */}
        <div className="fixed inset-0 z-[-1] bg-black">
          <Image
            src="/background.png"
            alt="Noir background"
            fill
            priority
            className="object-cover opacity-50 grayscale"
            quality={90}
          />
          {/* Overlay sutil para garantir legibilidade nas bordas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        </div>

        <main className="relative z-10 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}

