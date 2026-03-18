import type { Metadata } from "next";
import { Inter, Cagliostro } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { SolanaWalletProvider } from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });
const cagliostro = Cagliostro({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cagliostro"
});

export const metadata: Metadata = {
  title: "Aero DEX",
  description: "A high-performance Solana DEX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${cagliostro.variable} dot-bg bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SolanaWalletProvider>
            <Navbar />
            {children}
          </SolanaWalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
