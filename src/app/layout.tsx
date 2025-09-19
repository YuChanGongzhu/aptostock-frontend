import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { Toaster } from "@/components/ui/toaster";
import { WrongNetworkAlert } from "@/components/WrongNetworkAlert";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Aptos Boilerplate Template",
  title: "NextJS Boilerplate Template",
  description: "Aptos Boilerplate Template",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="dark">
        <WalletProvider>
          <ReactQueryProvider>
            <div className="min-h-screen bg-app-gradient text-foreground">
              <div id="root" className="relative">
                {/* Background mesh */}
                <div aria-hidden className="pointer-events-none fixed inset-0 select-none opacity-60">
                  <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_10%,rgba(14,165,233,0.18)_0%,transparent_60%),radial-gradient(50%_50%_at_80%_0%,rgba(34,211,238,0.18)_0%,transparent_55%)]" />
                  <div className="absolute inset-0 bg-hex opacity-40" />
                </div>
                <div className="relative">
                  {children}
                </div>
              </div>
              <WrongNetworkAlert />
              <Toaster />
            </div>
          </ReactQueryProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
