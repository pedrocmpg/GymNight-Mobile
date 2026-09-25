/**
 * Property-Based Test — Property 89
 *
 * Cardio NUNCA entra no contador `X/Y séries` nem na ProgressBar do header —
 * ambos vêm só de `countGridProgress` (setGrid.ts), que nem recebe cardio
 * como entrada. Testado no nível do componente: adicionar entradas de
 * cardio a uma sessão nunca muda o texto do contador nem o valor da barra.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import {
  ActiveSessionScreen,
  type ActiveSessionProps,
  type ActiveSessionCardioEntry,
  type ActiveSessionExerciseOption,
} from '../ActiveSessionScreen';

const STARTED_AT = new Date('2024-01-01T00:00:00.000Z').getTime();

function makeOption(
  overrides: Partial<ActiveSessionExerciseOption> & { id: string; name: string },
): ActiveSessionExerciseOption {
  return { seriesTarget: 3, repsTarget: 10, weightTarget: 40, ...overrides };
}

const arbCardioEntry: fc.Arbitrary<ActiveSessionCardioEntry> = fc.record({
  id: fc.uuid(),
  cardioType: fc.constantFrom('Corrida Contínua (Trote)', 'Esteira (Caminhada Plana)'),
  durationMin: fc.integer({ min: 1, max: 120 }),
  distanceKm: fc.option(fc.float({ min: 0, max: 42, noNaN: true }), { nil: null }),
  pse: fc.integer({ min: 1, max: 10 }),
});

function renderScreen(cardioEntries: ActiveSessionCardioEntry[]) {
  const props: ActiveSessionProps = {
    session: { id: 'session-1', started_at: STARTED_AT },
    loggedSets: [],
    totalVolume: 0,
    exerciseOptions: [makeOption({ id: 'ex1', name: 'Supino' })],
    onLogSet: jest.fn(),
    onEndSession: jest.fn(),
    hasWorkout: true,
    workoutName: 'Treino A',
    cardioEntries,
    onAddCardio: jest.fn(),
    onRemoveCardio: jest.fn(),
  };
  return render(<ActiveSessionScreen {...props} />);
}

describe('Property 89: cardio nunca entra no contador de séries nem na ProgressBar (modo grade)', () => {
  it('o texto do contador é idêntico com e sem entradas de cardio, para qualquer quantidade', () => {
    fc.assert(
      fc.property(fc.array(arbCardioEntry, { minLength: 0, maxLength: 10 }), (cardioEntries) => {
        const withoutCardio = renderScreen([]);
        const counterWithout = withoutCardio.getByTestId('set-counter').props.children;
        withoutCardio.unmount();

        const withCardio = renderScreen(cardioEntries);
        const counterWith = withCardio.getByTestId('set-counter').props.children;
        withCardio.unmount();

        return JSON.stringify(counterWithout) === JSON.stringify(counterWith);
      }),
      { numRuns: 100 },
    );
  });

  it('a ProgressBar (accessibilityValue) é idêntica com e sem entradas de cardio', () => {
    fc.assert(
      fc.property(fc.array(arbCardioEntry, { minLength: 1, maxLength: 10 }), (cardioEntries) => {
        const withoutCardio = renderScreen([]);
        const barWithout = withoutCardio.getByTestId('session-progress').props.accessibilityValue;
        withoutCardio.unmount();

        const withCardio = renderScreen(cardioEntries);
        const barWith = withCardio.getByTestId('session-progress').props.accessibilityValue;
        withCardio.unmount();

        return JSON.stringify(barWithout) === JSON.stringify(barWith);
      }),
      { numRuns: 100 },
    );
  });

  it('caso concreto: 5 entradas de cardio não movem "0/3 séries" nem 0% de progresso', () => {
    const { getByTestId } = renderScreen(
      Array.from({ length: 5 }, (_, i) => ({
        id: `cardio-${i}`,
        cardioType: 'Corrida Contínua (Trote)',
        durationMin: 30,
        distanceKm: 5,
        pse: 7,
      })),
    );
    expect(getByTestId('set-counter').props.children).toBe('0/3 séries');
    expect(getByTestId('session-progress').props.accessibilityValue.now).toBe(0);
  });
});
