// Analytics.tsx
'use client';

import { GA_MEASUREMENT_ID, pageview } from '@/lib/gtm';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { Suspense, useEffect } from 'react';

const Pageview = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      pageview(pathname);
    }
  }, [pathname, searchParams]);

  return null;
};

export const Analytics = () => (
  <>
    {/* `useSearchParams` は、静的に書き出すページで、最も近い Suspense までをブラウザ側の
        描画に回す。GTM のタグを HTML に残すため、ここだけを囲む
        （https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering） */}
    <Suspense fallback={null}>
      <Pageview />
    </Suspense>
    {process.env.NEXT_PUBLIC_DEPLOY_ENV === 'production' && <GtmTag />}
  </>
);

const GtmTag = () => (
  <>
    <noscript>
      <iframe
        title="gtm-iframe"
        src={`https://www.googletagmanager.com/ns.html?id=${GA_MEASUREMENT_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer', '${GA_MEASUREMENT_ID}');
  `,
      }}
    />
  </>
);
