
'use client';
import React from 'react';
import { Card } from './ui/card';

const AdBanner = () => {
  const adClient = 'ca-pub-9565691968703931';
  const adSlot = '1276830363';

  if (!adClient || !adSlot || adClient.includes('XXX') || adSlot.includes('XXX')) {
    return (
       <Card className="h-24 flex items-center justify-center bg-muted/50 border-dashed">
            <p className="text-muted-foreground">Ad placeholder - Configure your AdSense client and slot in /src/components/AdBanner.tsx</p>
        </Card>
    );
  }

  return (
      <amp-ad width="100vw" height="320"
          type="adsense"
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-auto-format="rspv"
          data-full-width="">
        <div overflow=""></div>
      </amp-ad>
  );
};

export default AdBanner;
