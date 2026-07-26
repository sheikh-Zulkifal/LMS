"use client"
import { Poppins, Josefin_Sans} from "next/font/google";
import "./globals.css";
import {ThemeProvider} from "./utils/theme-provider";
import { Toaster } from "react-hot-toast";
import { Providers } from "./Provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-Poppins",
});

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-Josefin_Sans",
});



export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${poppins.variable} ${josefin.variable} !bg-white dark:bg-gradient-to-b bg-no-repeat dark:from-gray-900 dark:to-black duration-300 `}
      >
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-center" reverseOrder={false} />
        </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
