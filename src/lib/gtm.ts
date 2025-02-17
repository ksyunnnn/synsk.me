type WindowWithDataLayer = Window & {
  dataLayer: Record<string, unknown>[];
};

declare const window: WindowWithDataLayer;

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const pageview = (url: string) => {
  if (typeof window.dataLayer !== 'undefined') {
    window.dataLayer.push({
      event: 'pageview',
      page: url,
    });
  } else {
    // eslint-disable-next-line no-console
    console.log({
      event: 'pageview',
      page: url,
    });
  }
};
