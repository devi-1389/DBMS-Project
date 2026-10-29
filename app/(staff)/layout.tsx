import { SiteHeaderWithAccount } from "@/components/layout/site-chrome";
import { SiteFooter } from "@/components/layout/site-footer";

// Authorization happens in each page (<Protected area="staff">), not in this layout.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderWithAccount />
      <main id="main" tabIndex={-1} className="flex-1 pt-20 focus:outline-none">
        <div className="mx-auto max-w-7xl px-6 pt-8 pb-24 lg:px-10">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
