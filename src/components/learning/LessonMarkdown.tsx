import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

type LessonMarkdownProps = {
  content?: string | null;
  fallback?: string | null;
};

const components: Components = {
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table {...props} className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
};

const markdownClassName = [
  'break-words text-[15px] leading-7 text-slate-700 dark:text-slate-200',
  '[&_a]:font-semibold [&_a]:text-[#005bbf] [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 dark:[&_blockquote]:border-blue-700 dark:[&_blockquote]:text-slate-300',
  '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] dark:[&_code]:bg-slate-800',
  '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-slate-950 dark:[&_h1]:text-white',
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-slate-950 dark:[&_h2]:text-white',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:leading-snug [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100',
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-bold',
  '[&_li]:pl-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
  '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-sm dark:[&_pre]:bg-slate-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-bold [&_strong]:text-slate-950 dark:[&_strong]:text-white',
  '[&_table]:min-w-full [&_td]:border-t [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-slate-700',
  '[&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-bold dark:[&_th]:bg-slate-800',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
].join(' ');

export default function LessonMarkdown({ content, fallback }: LessonMarkdownProps) {
  const value = content?.trim() ? content : fallback ?? '';

  return (
    <div className={markdownClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        components={components}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
