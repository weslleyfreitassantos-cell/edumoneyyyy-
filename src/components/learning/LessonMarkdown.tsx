import type { ReactNode } from 'react';

type LessonMarkdownProps = {
  content?: string | null;
  fallback?: string | null;
};

function renderBlock(block: string, index: number): ReactNode {
  const heading = block.match(/^#{1,3}\s+(.+)$/);
  if (heading) {
    return <h2 key={`heading-${index}`} className="text-lg font-bold leading-7 text-slate-900 dark:text-slate-100">{heading[1]}</h2>;
  }

  return <p key={`paragraph-${index}`} className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700 dark:text-slate-200">{block}</p>;
}

export default function LessonMarkdown({ content, fallback }: LessonMarkdownProps) {
  const value = content?.trim() || fallback?.trim() || '';
  return <div className="space-y-3">{value.split(/\n\s*\n/).map((block, index) => renderBlock(block.trim(), index))}</div>;
}
