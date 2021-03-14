import React from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import { Dropbox } from 'dropbox';
import fetch from 'isomorphic-unfetch';
import { JSDOM } from 'jsdom';
import { entryFilter, normalizeDropboxId } from '../helper';
import Head from 'next/head';
import { parseTitle } from '../helper/perser';
import { TitleObject } from '../types';
import { CategoryTag } from '../components/category-tag';
import Interweave from 'interweave';
import { isMatchImageURL } from '../helper/is-match-image-url';
import ogs from 'open-graph-scraper';
import { buildOGPDOMString } from '../helper/build-ogp-domstring';
import { appImage, appTitle, hostname } from '../constants';
import dayjs from 'dayjs';
import { dayJaList } from '../helper/day-ja-list';

type Props = { html: string; titleObject: TitleObject, entryId: string, canonical: boolean };

export default function Entry({ html, titleObject: { title, date, meta }, entryId, canonical }: Props) {
  const fullTitle = `${title} - ${appTitle}`;
  const dateDayjs = dayjs(date);
  const dateString = `${dateDayjs.year()}/${dateDayjs.month() + 1}/${dateDayjs.date()} (${dayJaList[dateDayjs.day()]})`;

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta property='og:title' content={fullTitle} />
        <meta property='og:description' content={title} />
        <meta name='keywords' content={meta?.tags.join(',')} />
        <meta property='og:type' content='blog' />
        <meta property='og:url' content={`${hostname}/${entryId}`} />
        <meta property='og:image' content={appImage} />
        <meta property='og:site_name' content={appTitle} />
        <meta name='twitter:card' content='summary' />
        <meta name='twitter:site' content='@euxn23' />
        <meta name='twitter:url' content={`${hostname}/${entryId}`} />
        <meta name='twitter:title' content={fullTitle} />
        <meta name='twitter:description' content={title} />
        <meta name='twitter:image' content={appImage} />
        {canonical && <link rel='canonical' href={`${hostname}/${entryId.toLowerCase()}`} />}
      </Head>
      <div className='p-4 sm:p-8 w-full shadow-2xl'>
        <h1>{title}</h1>
        <div className='w-full flex flex-col'>
          <div className='flex justify-end m-1'>
            <p>{dateString}</p>
          </div>
          <div className='flex justify-end flex-wrap'>
            {meta &&
            meta.tags &&
            meta.tags.map((tag: string, idx: number) => (
              <CategoryTag key={idx} tag={tag} />
            ))}
          </div>
        </div>
        <Interweave content={html} />
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
  const { result } = await dbx.filesListFolder({
    path: ''
  });

  const caseSensitivePaths = result.entries
    .filter(entryFilter)
    .map((entry) => `/${normalizeDropboxId(entry.id)}`);

  return {
    paths: [...caseSensitivePaths, ...caseSensitivePaths.map(p => p.toLowerCase())],
    fallback: false
  };
};

type StaticProps = {
  id: string;
};
export const getStaticProps: GetStaticProps<Props, StaticProps> = async (
  context
) => {
  const entryId = context.params?.id;
  if (!entryId) {
    throw new Error();
  }

  const canonical = entryId !== entryId.toLowerCase();

  const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch });
  const { result } = await dbx.filesListFolder({ path: '' });
  const entry = result.entries
    .filter(entryFilter)
    .find((e) => normalizeDropboxId(e.id).toLowerCase() === entryId.toLowerCase());
  if (!entry?.path_display) {
    throw new Error();
  }

  const metadata = await dbx.filesExport({
    path: entry.path_display
  });
  const buf: Buffer = (metadata.result as any).fileBinary;

  const { window } = new JSDOM(buf.toString());
  const { body } = window.document;

  const anchorDOMs = Array.from(body.querySelectorAll('a'));

  const imagesDOMs = anchorDOMs.filter((el) => isMatchImageURL(el.href));
  const urlDOMs = anchorDOMs.filter((el) => !isMatchImageURL(el.href))
    .filter((el) => {
      try {
        new URL(el.text);
        return true;
      } catch {
        return false;
      }
    });

  // replace image url to img tag
  imagesDOMs.forEach((el) => {
    const imgEl = window.document.createElement('img');
    imgEl.src = el.href;
    imgEl.className = 'w-64';
    el.replaceWith(imgEl);
  });

  // extend OGP
  await Promise.all(urlDOMs.map(async (el) => {
    if (el.href.match(/twitter\.com/)) {
      const twitterDOMString = `\
<div>
<blockquote class="twitter-tweet">
  <a href="${el.href}">${el.href}</a>
</blockquote>
</div>
`
      const twitterEl = new JSDOM(twitterDOMString).window.document.body;
      el.replaceWith(twitterEl)
      return;
    }

    const ogpResult = await ogs({ url: el.href, timeout: 3600 }).then((data) => data.error ? undefined : data.result);
    if (!ogpResult) {
      return;
    }

    const ogpDOMString = buildOGPDOMString(el.href, ogpResult);

    const ogpEl = new JSDOM(ogpDOMString).window.document.body;
    el.replaceWith(ogpEl);
  }));

  const titleDOM = body.querySelector<HTMLDivElement>('div.ace-line:first-child');
  const titleObject = parseTitle(titleDOM?.textContent || undefined);
  titleDOM?.remove();

  if (titleDOM) {
    titleDOM.textContent = titleObject.title;
  }

  const html = `\
<div>
${window.document.body.innerHTML}
</div>`;

  return { props: { html, titleObject, entryId: entryId.toLowerCase(), canonical }, revalidate: 60 };
};
