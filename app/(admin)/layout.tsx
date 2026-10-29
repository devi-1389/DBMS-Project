import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeaderWithAccount } from "@/components/layout/site-chrome";

// Authorization happens in each page (<Protected area="admin">), not in this layout.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderWithAccount />
      <main id="main" tabIndex={-1} className="flex-1 pt-20 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
