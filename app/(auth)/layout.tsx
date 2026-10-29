export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-svh flex-1">
      {children}
    </main>
  );
}
