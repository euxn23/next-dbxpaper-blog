import {
  default as NextDocument,
  Html,
  Head,
  Main,
  NextScript
} from 'next/document';
import { appImage } from '../constants';

const { NEXT_PUBLIC_GA_TRACKING_ID } = process.env;

export default class Document extends NextDocument {
  render() {
    return (
      <Html>
        <Head>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${NEXT_PUBLIC_GA_TRACKING_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${NEXT_PUBLIC_GA_TRACKING_ID}', {
                page_path: window.location.pathname,
              });
          `
            }}
          />
          <link rel="shortcut icon" href="/static/favicon.ico" />
          <link rel="apple-touch-icon" href={appImage} />
        </Head>
        <body>
        <Main />
        <NextScript />
        </body>
        <script async src='https://platform.twitter.com/widgets.js' charSet="utf-8" />
      </Html>
    );
  }
}
