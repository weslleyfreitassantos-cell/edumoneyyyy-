// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import LessonMarkdown from './LessonMarkdown';

afterEach(() => cleanup());

describe('LessonMarkdown', () => {
  it('renders real lesson headings, adjacent lists and emphasis semantically', () => {
    const { container } = render(
      <LessonMarkdown
        content={`## Conhecimentos prévios
- Reconhecer elementos visuais em uma imagem ou descrição
- Distinguir observação do que é interpretação
## Reforços para dificuldades comuns
### OBSERVATION AND INTERPRETATION
**Dificuldade:** Misturar observação e interpretação

Uma observação descreve algo verificável na composição.`}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Conhecimentos prévios' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Reforços para dificuldades comuns' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'OBSERVATION AND INTERPRETATION' })).toBeTruthy();
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(screen.getByText('Dificuldade:')).toBeTruthy();
    expect(screen.queryByText(/##|###|- Reconhecer/)).toBeNull();
  });

  it('supports paragraphs, ordered lists, quotes, code, line breaks and math', () => {
    const { container } = render(
      <LessonMarkdown
        content={'# Título\nPrimeira linha\nSegunda linha\n\n1. Etapa um\n2. Etapa dois\n\n> Observe o padrão.\n\nUse `f(x)` para representar a função.\n\nUm termo em *ênfase*.\n\n```text\nconst x = 1;\n```\n\n$$\nx^2 + y^2 = z^2\n$$'}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeTruthy();
    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(screen.getByText('Observe o padrão.').tagName).toBe('P');
    expect(screen.getByText('ênfase').tagName).toBe('EM');
    expect(container.querySelector('code')?.textContent).toBe('f(x)');
    expect(container.querySelector('pre code')?.textContent).toContain('const x = 1;');
    expect(container.querySelector('.katex')).toBeTruthy();
  });

  it('keeps tables semantic inside a horizontally scrollable wrapper', () => {
    const { container } = render(
      <LessonMarkdown content={'| Etapa | Resultado |\n| --- | --- |\n| 1 | Observação |'} />,
    );

    const table = container.querySelector('table');
    expect(table?.parentElement?.tagName).toBe('DIV');
    expect(table?.parentElement?.className).toContain('overflow-x-auto');
    expect(table?.querySelectorAll('th')).toHaveLength(2);
    expect(table?.querySelectorAll('td')).toHaveLength(2);
  });

  it('does not execute or render raw HTML from lesson content', () => {
    const { container } = render(
      <LessonMarkdown content={'<script>window.lessonPwned = true</script>\n\nTexto seguro.'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Texto seguro.')).toBeTruthy();
    expect((window as Window & { lessonPwned?: boolean }).lessonPwned).toBeUndefined();
  });

  it('removes unsafe URL protocols while preserving secure links', () => {
    const { container } = render(
      <LessonMarkdown
        content={'[Link inseguro](javascript:alert(1)) e [link seguro](https://example.com/conteudo) e [link relativo](/learning/aula/1) e [link externo relativo](//outside.example/path)'}
      />,
    );

    const links = container.querySelectorAll('a');
    expect(links[0]?.textContent).toBe('Link inseguro');
    expect(links[0]?.getAttribute('href')).toBeNull();
    expect(links[1]?.textContent).toBe('link seguro');
    expect(links[1]?.getAttribute('href')).toBe('https://example.com/conteudo');
    expect(links[2]?.getAttribute('href')).toBe('/learning/aula/1');
    expect(links[3]?.getAttribute('href')).toBeNull();
  });

  it('loads only same-origin Markdown images and rejects external, protocol-relative, data, and traversal sources', () => {
    let deeplyEncodedTraversal = '../private.svg';
    for (let attempt = 0; attempt < 9; attempt += 1) {
      deeplyEncodedTraversal = encodeURIComponent(deeplyEncodedTraversal);
    }
    const { container } = render(
      <LessonMarkdown content={`![local](/learning/lesson/image.svg) ![external](https://tracker.example/pixel) ![protocol](//tracker.example/pixel) ![data](data:image/svg+xml,abc) ![traversal](/learning/../private/image.svg) ![deep traversal](/learning/${deeplyEncodedTraversal})`} />,
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('src')).toBe('/learning/lesson/image.svg');
    expect(images[0]?.getAttribute('alt')).toBe('local');
  });

  it('does not create event-handler attributes from raw HTML-like lesson input', () => {
    const { container } = render(
      <LessonMarkdown content={'<img src="/learning/x.svg" onerror="alert(1)">\n\nTexto seguro.'} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(screen.getByText('Texto seguro.')).toBeTruthy();
  });

  it('does not trust links generated inside mathematical expressions', () => {
    let container: HTMLElement | undefined;
    expect(() => {
      ({ container } = render(<LessonMarkdown content={'$\\href{javascript:alert(1)}{link}$'} />));
    }).not.toThrow();
    expect(container?.querySelector('.katex')).toBeTruthy();
    expect(container?.querySelector('a')).toBeNull();
  });

  it('keeps malformed mathematical expressions from breaking lesson rendering', () => {
    let container: HTMLElement | undefined;
    expect(() => {
      ({ container } = render(<LessonMarkdown content={'$\\unknowncommand{broken}$'} />));
    }).not.toThrow();
    expect(container?.querySelector('.katex')).toBeTruthy();
  });

  it('uses the fallback when the stored lesson content is empty', () => {
    render(<LessonMarkdown content="  " fallback="## Conteúdo alternativo" />);

    expect(screen.getByRole('heading', { name: 'Conteúdo alternativo' })).toBeTruthy();
  });
});
