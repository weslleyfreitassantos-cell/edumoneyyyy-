// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PsychologyAppointmentCalendar from './PsychologyAppointmentCalendar';

describe('PsychologyAppointmentCalendar', () => {
  it('enables days with free times and reports the selected date', () => {
    const onSelectDate = vi.fn();
    render(
      <PsychologyAppointmentCalendar
        availableDates={[
          { date: '2026-10-29', slotCount: 1 },
          { date: '2026-10-30', slotCount: 2 },
        ]}
        selectedDate=""
        initialMonth="2026-10"
        minDate="2026-10-01"
        maxDate="2026-10-31"
        onSelectDate={onSelectDate}
      />,
    );

    const availableDay = screen.getByRole('button', { name: /29.*1 horário disponível/i });
    expect((availableDay as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /28.*sem horários disponíveis/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(availableDay);
    expect(onSelectDate).toHaveBeenCalledWith('2026-10-29');
  });
});
