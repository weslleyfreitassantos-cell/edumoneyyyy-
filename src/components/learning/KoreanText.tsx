import { Fragment } from 'react';

import { koreanRomanizationParts } from '../../lib/koreanRomanization';

interface KoreanTextProps {
  text: string;
  enabled: boolean;
}

export default function KoreanText({ text, enabled }: KoreanTextProps) {
  if (!enabled) return text;

  return (
    <>
      {koreanRomanizationParts(text).map((part, index) => (
        <Fragment key={`${index}-${part.text}`}>
          {part.text}
          {part.romanization ? <span className="ml-1 inline-block whitespace-nowrap text-[0.9em] font-medium opacity-70">({part.romanization})</span> : null}
        </Fragment>
      ))}
    </>
  );
}
