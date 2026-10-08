import { describe, expect, it } from 'vitest';

import { parseXequematQuestionHtml } from './xequemat-archive';

describe('Xequemat archive parser', () => {
  it('preserves ordered statement media and excludes the solution from the student content', () => {
    const html = `
      <html><head><title>Questão 171 - ENEM 2015</title></head><body>
        <h1>Questão 171 - ENEM 2015</h1>
        <div class="elementor-widget-theme-post-content">
          <p>O contexto completo da questão aparece antes da pergunta.</p>
          <figure><img src="/uploads/diagram.png" alt="Diagrama"></figure>
          <p>Considerando o contexto apresentado, qual alternativa está correta?</p>
          <p>A) Primeira alternativa.</p><p>B) Segunda alternativa.</p>
          <p>C) Terceira alternativa.</p><p>D) Quarta alternativa.</p>
          <p>E) Quinta alternativa.</p>
          <p><strong>Resolução</strong></p><p>A alternativa correta é D.</p>
          <h3>Pratique mais questões semelhantes</h3><p>Não deve entrar.</p>
        </div>
      </body></html>`;
    const record = parseXequematQuestionHtml(html, {
      sourceFile: 'blog/questao-171-enem-2015/index.html',
      resolveMedia: (source) => ({ source, alt: '', archivePath: 'uploads/diagram.png', canonicalPath: 'enem/v1/diagram.png', missing: false }),
      rightsStatus: 'VERIFIED',
    });
    expect(record.ready).toBe(true);
    expect(record.contextText).toContain('contexto completo');
    expect(record.promptText).toContain('qual alternativa');
    expect(record.blocks.map((block) => block.kind)).toEqual(['PARAGRAPH', 'IMAGE', 'PARAGRAPH']);
    expect(record.media).toHaveLength(1);
    expect(record.explanationText).toContain('Resolução');
    expect(record.explanationText).not.toContain('Não deve entrar');
    expect(record.correctAlternative).toBe('D');
  });

  it('rejects a fragment that depends on missing context and missing media', () => {
    const html = `<html><head><title>Questão 10 - ENEM PPL 2019</title></head><body>
      <h1>Questão 10 - ENEM PPL 2019</h1>
      <div class="elementor-widget-theme-post-content">
        <p>A partir disso, qual alternativa está correta?</p>
        <p>A) Um.</p><p>B) Dois.</p><p>C) Três.</p><p>D) Quatro.</p><p>E) Cinco.</p>
        <p>Gabarito: A</p>
      </div></body></html>`;
    const record = parseXequematQuestionHtml(html, {
      sourceFile: 'blog/questao-10-enem-ppl-2019/index.html',
      resolveMedia: (source) => ({ source, alt: '', archivePath: null, canonicalPath: null, missing: true }),
    });
    expect(record.ready).toBe(false);
    expect(record.rejectionReasons).toContain('INCOMPLETE_STATEMENT');
    expect(record.rejectionReasons).toContain('RIGHTS_UNRESOLVED');
  });

  it('does not invent a source identity when the page has no valid year or number', () => {
    const record = parseXequematQuestionHtml(
      '<div class="elementor-widget-theme-post-content"><p>Texto completo da questão.</p><p>A) Um.</p><p>B) Dois.</p><p>C) Três.</p><p>D) Quatro.</p><p>E) Cinco.</p><p>Gabarito: A</p></div>',
      { sourceFile: 'blog/questao-digital/index.html', rightsStatus: 'VERIFIED' },
    );
    expect(record.rejectionReasons).toContain('INVALID_SOURCE_IDENTITY');
    expect(record.ready).toBe(false);
  });
});
