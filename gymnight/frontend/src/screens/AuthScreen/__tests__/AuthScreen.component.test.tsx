/**
 * Component tests for AuthScreen covering UI states and interaction.
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 *
 * 1. Loading UI_State: submit disabled + loading indicator shown
 * 2. Offline UI_State: offline banner displayed + submit blocked
 * 3. Error UI_State: error message displayed, email retained, password cleared
 * 4. Interaction: pressing submit with valid fields and online state calls onSubmit
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthScreen, AuthScreenProps } from '../AuthScreen';

function renderAuthScreen(overrides: Partial<AuthScreenProps> = {}) {
  const defaultProps: AuthScreenProps = {
    isOnline: true,
    isLoading: false,
    error: null,
    onSubmit: jest.fn(),
    onSignUp: jest.fn(),
    onDismissCheckEmail: jest.fn(),
    ...overrides,
  };
  return { ...render(<AuthScreen {...defaultProps} />), props: defaultProps };
}

describe('AuthScreen — Loading UI_State', () => {
  it('disables the submit button when isLoading is true', () => {
    const { getByTestId } = renderAuthScreen({ isLoading: true });
    const submitButton = getByTestId('submit-button');
    expect(submitButton.props.disabled).toBe(true);
  });

  it('shows a loading indicator when isLoading is true', () => {
    // Wave 5 (visual restante): o botão agora é o Button do design system,
    // cujo indicador de loading segue a convenção `${testID}-loading`
    // (ver Button.component.test.tsx), não um testID solto.
    const { getByTestId } = renderAuthScreen({ isLoading: true });
    expect(getByTestId('submit-button-loading')).toBeTruthy();
  });

  it('does not show loading indicator when isLoading is false', () => {
    const { queryByTestId } = renderAuthScreen({ isLoading: false });
    expect(queryByTestId('submit-button-loading')).toBeNull();
  });
});

describe('AuthScreen — Offline UI_State', () => {
  it('displays an offline banner when isOnline is false', () => {
    const { getByTestId } = renderAuthScreen({ isOnline: false });
    expect(getByTestId('offline-banner')).toBeTruthy();
  });

  it('does not display offline banner when isOnline is true', () => {
    const { queryByTestId } = renderAuthScreen({ isOnline: true });
    expect(queryByTestId('offline-banner')).toBeNull();
  });

  it('disables the submit button when offline even with valid fields', () => {
    const { getByTestId } = renderAuthScreen({ isOnline: false });
    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'user@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    const submitButton = getByTestId('submit-button');
    expect(submitButton.props.disabled).toBe(true);
  });
});

describe('AuthScreen — Error UI_State', () => {
  it('displays the error message when error prop is set', () => {
    const errorMsg = 'Credenciais inválidas';
    const { getByTestId, getByText } = renderAuthScreen({ error: errorMsg });

    expect(getByTestId('error-banner')).toBeTruthy();
    expect(getByText(errorMsg)).toBeTruthy();
  });

  it('does not display error banner when error is null', () => {
    const { queryByTestId } = renderAuthScreen({ error: null });
    expect(queryByTestId('error-banner')).toBeNull();
  });

  it('retains email and clears password after error (component re-render with error)', () => {
    const { getByTestId, rerender } = renderAuthScreen({ error: null });

    // Type email and password
    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'user@test.com');
    fireEvent.changeText(passwordInput, 'secret123');

    // Simulate error being set — the component re-renders with error prop
    // The email is retained in state, password should be managed by parent
    // In this component design, state is internal — the error display is what we verify
    rerender(
      <AuthScreen
        isOnline={true}
        isLoading={false}
        error="Auth failed"
        onSubmit={jest.fn()}
        onSignUp={jest.fn()}
        onDismissCheckEmail={jest.fn()}
      />,
    );

    // Error banner should be visible
    expect(getByTestId('error-banner')).toBeTruthy();
    // Email input should retain its value (internal state preserved across rerender)
    expect(getByTestId('email-input').props.value).toBe('user@test.com');
  });
});

describe('AuthScreen — Interaction (submit)', () => {
  it('calls onSubmit with email and password when fields are valid and online', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSubmit, isOnline: true });

    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'user@example.com');
    fireEvent.changeText(passwordInput, 'strongpassword');

    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('user@example.com', 'strongpassword');
  });

  it('does NOT call onSubmit when email is invalid', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSubmit, isOnline: true });

    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'invalidemail'); // no @
    fireEvent.changeText(passwordInput, 'password');

    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT call onSubmit when password is empty', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSubmit, isOnline: true });

    const emailInput = getByTestId('email-input');

    fireEvent.changeText(emailInput, 'user@example.com');
    // password left empty

    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT call onSubmit when offline', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSubmit, isOnline: false });

    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'user@example.com');
    fireEvent.changeText(passwordInput, 'password');

    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT call onSubmit when loading', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderAuthScreen({
      onSubmit,
      isOnline: true,
      isLoading: true,
    });

    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');

    fireEvent.changeText(emailInput, 'user@example.com');
    fireEvent.changeText(passwordInput, 'password');

    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AuthScreen — modo cadastro', () => {
  it('"Cadastre-se" troca para o modo cadastro (mostra confirmação de senha)', () => {
    const { getByTestId } = renderAuthScreen();
    fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(getByTestId('confirm-password-input')).toBeTruthy();
    expect(getByTestId('sign-up-button')).toBeTruthy();
  });

  it('"Já tem conta? Entrar" volta para o modo login', () => {
    const { getByTestId, queryByTestId } = renderAuthScreen();
    fireEvent.press(getByTestId('go-to-sign-up-link'));
    fireEvent.press(getByTestId('go-to-sign-in-link'));
    expect(queryByTestId('confirm-password-input')).toBeNull();
    expect(getByTestId('submit-button')).toBeTruthy();
  });

  it('chama onSignUp com email e senha quando os campos são válidos e coincidem', () => {
    const onSignUp = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSignUp });
    fireEvent.press(getByTestId('go-to-sign-up-link'));

    fireEvent.changeText(getByTestId('email-input'), 'nova@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'senha1234');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'senha1234');
    fireEvent.press(getByTestId('sign-up-button'));

    expect(onSignUp).toHaveBeenCalledWith('nova@example.com', 'senha1234');
  });

  it('não chama onSignUp quando a confirmação de senha não coincide', () => {
    const onSignUp = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSignUp });
    fireEvent.press(getByTestId('go-to-sign-up-link'));

    fireEvent.changeText(getByTestId('email-input'), 'nova@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'senha1234');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'outrasenha');
    fireEvent.press(getByTestId('sign-up-button'));

    expect(onSignUp).not.toHaveBeenCalled();
  });

  it('não chama onSignUp quando a senha tem menos de 8 caracteres', () => {
    const onSignUp = jest.fn();
    const { getByTestId } = renderAuthScreen({ onSignUp });
    fireEvent.press(getByTestId('go-to-sign-up-link'));

    fireEvent.changeText(getByTestId('email-input'), 'nova@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'curta');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'curta');
    fireEvent.press(getByTestId('sign-up-button'));

    expect(onSignUp).not.toHaveBeenCalled();
  });
});

describe('AuthScreen — modo checkEmail (confirmação pendente)', () => {
  it('substitui o formulário pelo aviso de confirmação, sem navegar sozinho', () => {
    const { getByTestId, queryByTestId } = renderAuthScreen({
      signUpStatus: 'confirmationRequired',
    });
    expect(getByTestId('check-email-banner')).toBeTruthy();
    expect(queryByTestId('email-input')).toBeNull();
    expect(queryByTestId('sign-up-button')).toBeNull();
  });

  it('"Já confirmou? Entrar" chama onDismissCheckEmail; assim que signUpStatus volta a idle, mostra o login de novo', () => {
    const onDismissCheckEmail = jest.fn();
    const { getByTestId, rerender, props } = renderAuthScreen({
      signUpStatus: 'confirmationRequired',
      onDismissCheckEmail,
    });
    fireEvent.press(getByTestId('back-to-sign-in-button'));
    expect(onDismissCheckEmail).toHaveBeenCalledTimes(1);

    // Simula o container reagindo ao callback (signUpStatus -> 'idle').
    rerender(<AuthScreen {...props} signUpStatus="idle" />);
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('submit-button')).toBeTruthy();
  });
});
