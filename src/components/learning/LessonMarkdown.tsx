import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { Element, Parent, Root } from 'hast';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import 'katex/dist/katex.min.css';

type LessonMarkdownProps = {
  content?: string | null;
  fallback?: string | null;
};

const allowedProtocols: Record<'href' | 'src', Set<string>> = {
  href: new Set(['http', 'https', 'mailto', 'tel']),
  src: new Set(['http', 'https']),
};

function sanitizeMarkdownUrls() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      for (const attribute of ['href', 'src'] as const) {
        const value = node.properties[attribute];
        if (typeof value !== 'string') continue;

        const normalized = value.trim().replace(/[\u0000-\u0020]+/g, '').replace(/\\/g, '/');
        const protocol = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1]?.toLowerCase();
        if (protocol && !allowedProtocols[attribute].has(protocol)) {
          delete node.properties[attribute];
        }
      }
    });
  };
}

function wrapMarkdownTables() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return;

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['my-4', 'overflow-x-auto', 'rounded-lg', 'border', 'border-slate-200', 'dark:border-slate-700'],
        },
        children: [node],
      };
      return SKIP;
    });
  };
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkMath)
  .use(remarkRehype)
  .use(wrapMarkdownTables)
  .use(rehypeKatex)
  .use(sanitizeMarkdownUrls);

const markdownClassName = [
  'break-words text-[15px] leading-7 text-slate-700 dark:text-slate-200',
  '[&_a]:font-semibold [&_a]:text-[#005bbf] [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 dark:[&_blockquote]:border-blue-700 dark:[&_blockquote]:text-slate-300',
  '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] dark:[&_code]:bg-slate-800',
  '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-slate-950 dark:[&_h1]:text-white',
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-slate-950 dark:[&_h2]:text-white',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:leading-snug [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100',
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-bold',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full',
  '[&_li]:pl-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
  '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-sm dark:[&_pre]:bg-slate-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-bold [&_strong]:text-slate-950 dark:[&_strong]:text-white',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm',
  '[&_td]:border-t [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-slate-700',
  '[&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-bold dark:[&_th]:bg-slate-800',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
].join(' ');

export default function LessonMarkdown({ content, fallback }: LessonMarkdownProps) {
  const value = content?.trim() ? content : fallback ?? '';
  const tree = markdownProcessor.runSync(markdownProcessor.parse(value)) as Root;
  const renderedContent = toJsxRuntime(tree, { Fragment, jsx, jsxs });

  return (
    <div className={markdownClassName}>
      {renderedContent}
    </div>
  );
}
