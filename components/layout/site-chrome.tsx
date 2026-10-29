import { Suspense } from "react";

import {
  AccountControls,
  AccountControlsFallback,
  MobileAccountControls,
} from "@/components/layout/account-controls";
import { SiteHeader } from "@/components/layout/site-header";

/** Site header with live account controls. The account parts stream in per request. */
export function SiteHeaderWithAccount() {
  return (
    <SiteHeader
      account={
        <Suspense fallback={<AccountControlsFallback />}>
          <AccountControls />
        </Suspense>
      }
      mobileAccount={
        <Suspense fallback={null}>
          <MobileAccountControls />
        </Suspense>
      }
    />
  );
}
