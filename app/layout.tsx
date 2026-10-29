import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/auth/appearance";
import { AUTH_PATHS, isClerkConfigured } from "@/lib/auth/config";

import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SOLACE | Luxury, Nature & Adventure Resort",
    template: "%s | SOLACE",
  },
  description:
    "SOLACE resort: luxury, nature, adventure, wellness, local and sustainable experiences, matched to your preferences, budget and schedule by LUXE-ECO.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Without keys Clerk isn't loaded at all; protected areas fail closed (see proxy.ts).
  // No `dynamic` prop, so the provider doesn't read request data and needs no Suspense.
  const content = isClerkConfigured() ? (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl={AUTH_PATHS.signIn}
      signUpUrl={AUTH_PATHS.signUp}
      signInFallbackRedirectUrl={AUTH_PATHS.afterSignIn}
      signUpFallbackRedirectUrl={AUTH_PATHS.afterSignIn}
    >
      {children}
    </ClerkProvider>
  ) : (
    children
  );

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{content}</body>
    </html>
  );
}
