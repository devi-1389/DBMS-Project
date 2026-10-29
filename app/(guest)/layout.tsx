import { PreviewNotice } from "@/components/common/preview-notice";
import { GuestNav } from "@/components/layout/guest-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Phase 3: require a signed-in guest here (requireUser) before rendering children.
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 pt-20 focus:outline-none">
        <div className="mx-auto max-w-7xl px-6 pt-8 pb-24 lg:px-10">
          <PreviewNotice title="Guest area preview">
            Sign-in isn&apos;t connected yet, so this area isn&apos;t tied to an account. Preferences and
            itinerary drafts are saved in this browser only. No bookings can be made.
          </PreviewNotice>
          <div className="mt-6">
            <GuestNav />
          </div>
          <div className="pt-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
