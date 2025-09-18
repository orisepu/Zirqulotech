'use client';

import * as React from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useServerInsertedHTML } from 'next/navigation';

// Minimal Emotion SSR integration for Next.js App Router + MUI.
// Ensures the server and client use the same Emotion cache and
// that styles are injected during SSR to avoid hydration mismatches.

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  // Create one Emotion cache per request on the server, and a single
  // shared cache on the client.
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache({ key: 'mui' });
    cache.compat = true;

    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args: any[]) => {
      const serialized = args[1] as { name: string };
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return (prevInsert as any)(...args);
    };

    const flush = () => {
      const names = inserted;
      inserted = [];
      return names;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += (cache.inserted as Record<string, string>)[name];
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
