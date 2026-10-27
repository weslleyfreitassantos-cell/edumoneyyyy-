// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EnglishExerciseCard from './EnglishExerciseCard';
import type { EnglishExercise } from '../../services/tecEnglishService';

afterEach(cleanup);

describe('EnglishExerciseCard', () => {
  it('does not reveal the expected response in the pre-answer conversation context', () => {
    const expected = 'A single ticket to Oxford, please.';
    const exercise: EnglishExercise = {
      id: 'dialogue-1', position: 1, type: 'MULTIPLE_CHOICE', instruction: 'Leia a conversa e escolha.',
      prompt: 'Você só vai a Oxford e não voltará. Como responde?', options: [expected, 'A return ticket to Oxford, please.', 'A single ticket to Cambridge, please.'],
      word_bank: [], left_items: [], right_items: [], audio_text: null,
      dialogue_context: [{ speaker: 'Ticket clerk', text: 'Would you like a single or return ticket?' }],
    };
    render(<EnglishExerciseCard exercise={exercise} resetToken={0} onSubmit={vi.fn()} />);

    const context = screen.getByRole('region', { name: 'Contexto da conversa' });
    expect(context.textContent).not.toContain(expected);
    expect(screen.getByRole('button', { name: `A${expected}` })).toBeTruthy();
  });

  it('permite responder por texto quando o reconhecimento de voz não existe', () => {
    const onSubmit = vi.fn();
    const exercise: EnglishExercise = {
      id: 'speaking-1', position: 7, type: 'SPEAKING', instruction: 'Repita a frase.', prompt: 'Repita: “Are you a student?”',
      options: [], word_bank: [], left_items: [], right_items: [], audio_text: 'Are you a student?',
    };
    render(<EnglishExerciseCard exercise={exercise} resetToken={0} onSubmit={onSubmit} />);

    expect(screen.getByText('Seu navegador não oferece reconhecimento de voz. Digite a frase para continuar.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tentar falar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Sua frase em inglês'), { target: { value: 'Are you a student?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));

    expect(onSubmit).toHaveBeenCalledWith({ text: 'Are you a student?' });
  });

  it('exige completar os pares antes de enviar uma associação', () => {
    const onSubmit = vi.fn();
    const exercise: EnglishExercise = {
      id: 'matching-1', position: 5, type: 'MATCHING', instruction: 'Associe as palavras.', prompt: 'Encontre os pares.',
      options: [], word_bank: [], left_items: ['Hello', 'Goodbye'], right_items: ['Olá', 'Tchau'], audio_text: null,
    };
    render(<EnglishExerciseCard exercise={exercise} resetToken={0} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));
    expect(screen.getByRole('alert').textContent).toContain('Associe todos os pares');
    fireEvent.change(screen.getByLabelText('Significado para Hello'), { target: { value: 'Olá' } });
    fireEvent.change(screen.getByLabelText('Significado para Goodbye'), { target: { value: 'Tchau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));

    expect(onSubmit).toHaveBeenCalledWith({ pairs: { Hello: 'Olá', Goodbye: 'Tchau' } });
  });

  it('uses the matching course language for speech practice', () => {
    const exercise: EnglishExercise = {
      id: 'speaking-spanish', position: 7, type: 'SPEAKING', instruction: 'Pratique a frase.', prompt: 'Pratique: Hola.',
      options: [], word_bank: [], left_items: [], right_items: [], audio_text: 'Hola.', skill_code: 'es_v1_greetings_speaking',
    };
    render(<EnglishExerciseCard exercise={exercise} courseCode="TEC_SPANISH_FOUNDATIONS_V1" resetToken={0} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Sua frase em espanhol')).toBeTruthy();
  });
});
