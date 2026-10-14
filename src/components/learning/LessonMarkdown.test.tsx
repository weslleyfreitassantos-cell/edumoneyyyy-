// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LessonMarkdown from './LessonMarkdown';

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

  it('does not execute or render raw HTML from lesson content', () => {
    const { container } = render(
      <LessonMarkdown content={'<script>window.lessonPwned = true</script>\n\nTexto seguro.'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Texto seguro.')).toBeTruthy();
    expect((window as Window & { lessonPwned?: boolean }).lessonPwned).toBeUndefined();
  });

  it('uses the fallback when the stored lesson content is empty', () => {
    render(<LessonMarkdown content="  " fallback="## Conteúdo alternativo" />);

    expect(screen.getByRole('heading', { name: 'Conteúdo alternativo' })).toBeTruthy();
  });
});
