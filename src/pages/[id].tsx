import React from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import { Dropbox } from 'dropbox';
import fetch from 'isomorphic-unfetch';
import { entryFilter, normalizeDropboxId } from '../helper';
import Head from 'next/head';
import { TitleObject } from '../types';
import { CategoryTag } from '../components/category-tag';
import { appImage, appTitle, hostname } from '../constants';
import dayjs from 'dayjs';
import { dayJaList } from '../helper/day-ja-list';
import { parseTitle } from '../helper/perser';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import gfm from 'remark-gfm'

type Props = { content: string, titleObject: TitleObject, entryId: string, canonical: boolean };

const components = {
  code({node, inline, className, children, ...props}: any) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <SyntaxHighlighter language={match[1]} PreTag="div" children={String(children).replace(/\n$/, '')} {...props} />
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
}

const Entry: React.FC<Props> = ({ content, titleObject: { title, date, meta }, entryId, canonical }) => {
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
        <ReactMarkdown className="whitespace-normal" components={components as any} remarkPlugins={[gfm]} children={content} />
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
    path: entry.path_display,
    export_format: 'markdown'
  });
  const buf: Buffer = (metadata.result as any).fileBinary;
  const mdContentRawStr = buf.toString()
  const mdContentLines = mdContentRawStr.split("\n")
  const [titleText, ...contentLines] = mdContentLines
  const titleObject = parseTitle(titleText.replace(/^#\s/, ''));
  const content = contentLines.join("\n")

  return { props: { content, titleObject, entryId: entryId.toLowerCase(), canonical }, revalidate: 60 };
};

export default Entry