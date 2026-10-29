import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Phase 3: require the admin role here (requireRole("admin")) before rendering children.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 pt-20 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
