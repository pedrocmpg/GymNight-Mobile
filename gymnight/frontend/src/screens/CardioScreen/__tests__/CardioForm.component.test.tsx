/**
 * Component tests for CardioForm — busca de tipo, validação, PSE, estimativa
 * de calorias ao vivo, e o callback final.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CardioForm } from '../CardioForm';

describe('CardioForm', () => {
  it('desabilita "Adicionar" até um tipo, duração válida e distância válida estarem presentes', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(<CardioForm onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.press(getByTestId('cardio-save-button'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('filtra a lista de tipos ao buscar, sem acento nem caixa', () => {
    const { getByTestId, queryByTestId } = render(<CardioForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'esteira');
    expect(getByTestId('cardio-type-option-Esteira (Caminhada Plana)')).toBeTruthy();
    expect(queryByTestId('cardio-type-option-Vôlei')).toBeNull();
  });

  it('selecionar um tipo mostra a descrição do esforço', () => {
    const { getByTestId, getByText } = render(<CardioForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'caminhada plana');
    fireEvent.press(getByTestId('cardio-type-option-Esteira (Caminhada Plana)'));
    expect(getByText('Respiração normal, dá para cantar uma música.')).toBeTruthy();
  });

  it('mostra a estimativa de calorias ao vivo e recalcula ao mudar duração/PSE', () => {
    const { getByTestId, getByText } = render(<CardioForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'corrida');
    fireEvent.press(getByTestId('cardio-type-option-Corrida Contínua (Trote)'));
    fireEvent.changeText(getByTestId('cardio-duration-input'), '60');
    fireEvent.press(getByTestId('cardio-pse-7')); // bucket 9.0 MET

    // 9.0 MET × 70kg × 1h = 630 kcal
    expect(getByText('630 kcal')).toBeTruthy();

    fireEvent.press(getByTestId('cardio-pse-2')); // bucket 3.0 MET
    // 3.0 MET × 70kg × 1h = 210 kcal
    expect(getByText('210 kcal')).toBeTruthy();
  });

  it('chama onSave com todos os campos, incluindo distância opcional ausente (null)', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(<CardioForm onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'corrida');
    fireEvent.press(getByTestId('cardio-type-option-Corrida Contínua (Trote)'));
    fireEvent.changeText(getByTestId('cardio-duration-input'), '30');
    fireEvent.press(getByTestId('cardio-pse-6'));
    fireEvent.press(getByTestId('cardio-save-button'));

    expect(onSave).toHaveBeenCalledWith({
      cardioType: 'Corrida Contínua (Trote)',
      durationMin: 30,
      distanceKm: null,
      pse: 6,
    });
  });

  it('chama onSave com a distância informada quando preenchida', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(<CardioForm onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'corrida');
    fireEvent.press(getByTestId('cardio-type-option-Corrida Contínua (Trote)'));
    fireEvent.changeText(getByTestId('cardio-duration-input'), '30');
    fireEvent.changeText(getByTestId('cardio-distance-input'), '5');
    fireEvent.press(getByTestId('cardio-pse-6'));
    fireEvent.press(getByTestId('cardio-save-button'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ distanceKm: 5 }),
    );
  });

  it('chama onCancel ao tocar em "Cancelar"', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(<CardioForm onSave={jest.fn()} onCancel={onCancel} />);
    fireEvent.press(getByTestId('cardio-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mostra "nenhum tipo encontrado" quando a busca não bate com nada', () => {
    const { getByTestId } = render(<CardioForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(getByTestId('cardio-type-search'), 'xyz-nao-existe');
    expect(getByTestId('cardio-type-no-results')).toBeTruthy();
  });

  it('PSE começa em 5 (Moderado) por default', () => {
    const { getByTestId } = render(<CardioForm onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(getByTestId('cardio-pse-5').props.accessibilityState.selected).toBe(true);
  });
});
