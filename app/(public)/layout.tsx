import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeaderWithAccount } from "@/components/layout/site-chrome";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeaderWithAccount />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
