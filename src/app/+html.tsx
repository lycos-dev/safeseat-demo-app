import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#101322" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { min-height: 100%; margin: 0; background: #080a12; }
          body { overflow: hidden; }
          #root { display: flex; justify-content: center; }
          #root > div { width: 100%; max-width: 393px; min-height: 100dvh; max-height: 852px; background: #101322; overflow: hidden; box-shadow: 0 0 50px rgba(0,0,0,.38); }
          @media (max-width: 393px), (max-height: 852px) {
            #root > div { max-width: none; max-height: none; min-height: 100dvh; box-shadow: none; }
          }
          * { box-sizing: border-box; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
