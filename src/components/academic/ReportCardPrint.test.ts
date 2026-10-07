import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));
const printStyles = readFileSync(resolve(directory, '../../index.css'), 'utf8');
const reportCardView = readFileSync(resolve(directory, './ReportCardView.tsx'), 'utf8');

describe('report card printing contract', () => {
  it('restores report card visibility after the print reset hides the page', () => {
    expect(reportCardView).toContain('report-card-printable');
    expect(printStyles).toMatch(
      /\.report-card-printable,\s*\.report-card-printable \* \{\s*visibility: visible !important;/,
    );
    expect(printStyles).toMatch(/\.report-card-printable \{[\s\S]*position: absolute !important;/);
    expect(printStyles).toContain('.report-card-printable article');
  });

  it('keeps the print action and mobile-only layout out of the printed document', () => {
    expect(reportCardView).toContain('onClick={() => window.print()}');
    expect(reportCardView).toContain('print:hidden');
    expect(reportCardView).toContain('hidden overflow-x-auto sm:block print:block');
    expect(reportCardView).toContain('sm:hidden print:hidden');
  });
});
