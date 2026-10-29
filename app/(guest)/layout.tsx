import { Suspense } from "react";

import { GuestNav, GuestNavFallback } from "@/components/layout/guest-nav";
import { SiteHeaderWithAccount } from "@/components/layout/site-chrome";
import { SiteFooter } from "@/components/layout/site-footer";

// Authorization happens in each page (<Protected area="guest">) and in every Server
// Action, not in this layout: layouts don't re-run on every navigation.
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderWithAccount />
      <main id="main" tabIndex={-1} className="flex-1 pt-20 focus:outline-none">
        <div className="mx-auto max-w-7xl px-6 pt-8 pb-24 lg:px-10">
          {/* usePathname() isn't known at prerender time on dynamic routes like /my-bookings/[reference]. */}
          <Suspense fallback={<GuestNavFallback />}>
            <GuestNav />
          </Suspense>
          <div className="pt-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
