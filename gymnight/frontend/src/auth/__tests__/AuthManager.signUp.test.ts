/**
 * AuthManager.signUp — cadastro por email/senha via Supabase Auth.
 *
 * Este projeto Supabase exige confirmação de email (verificado ao vivo
 * contra a API real): um signUp bem-sucedido nunca retorna sessão, então o
 * caminho principal é `{ success: true, status: 'confirmationRequired' }`,
 * sem persistir nada em Secure_Storage. O caminho `navigateTo: 'dashboard'`
 * existe apenas defensivamente, caso a confirmação seja desabilitada no
 * futuro — mesma garantia de ordenação do signIn (persiste antes de
 * retornar sucesso).
 */
import { AuthManager, SupabaseAuthClient, SecureStoragePort } from '../AuthManager';
import { Session } from '../SecureStorage';

const session: Session = {
  access_token: 'token-abc',
  refresh_token: 'refresh-abc',
  user_id: 'user-abc',
};

describe('AuthManager.signUp', () => {
  it('sem sessão de volta (confirmação pendente): retorna confirmationRequired e não persiste nada', async () => {
    const saveSession = jest.fn();
    const supabaseAuth: SupabaseAuthClient = {
      async signInWithPassword() {
        throw new Error('not used');
      },
      async signUp(_credentials) {
        return { data: { session: null }, error: null };
      },
    };
    const storage: SecureStoragePort = {
      saveSession,
      async loadSession() {
        return null;
      },
      async clearSession() {},
    };

    const authManager = new AuthManager(supabaseAuth, storage);
    const result = await authManager.signUp('nova@example.com', 'senha1234');

    expect(result).toEqual({ success: true, status: 'confirmationRequired' });
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('erro do Supabase: retorna failure com a mensagem original', async () => {
    const supabaseAuth: SupabaseAuthClient = {
      async signInWithPassword() {
        throw new Error('not used');
      },
      async signUp(_credentials) {
        return { data: { session: null }, error: { message: 'User already registered' } };
      },
    };
    const storage: SecureStoragePort = {
      async saveSession() {},
      async loadSession() {
        return null;
      },
      async clearSession() {},
    };

    const authManager = new AuthManager(supabaseAuth, storage);
    const result = await authManager.signUp('ja-existe@example.com', 'senha1234');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('User already registered');
    }
  });

  it('com sessão imediata (defensivo — confirmação desabilitada): persiste antes de retornar navigateTo', async () => {
    const saveSession = jest.fn(async () => {});
    const supabaseAuth: SupabaseAuthClient = {
      async signInWithPassword() {
        throw new Error('not used');
      },
      async signUp(_credentials) {
        return { data: { session }, error: null };
      },
    };
    const storage: SecureStoragePort = {
      saveSession,
      async loadSession() {
        return null;
      },
      async clearSession() {},
    };

    const authManager = new AuthManager(supabaseAuth, storage);
    const result = await authManager.signUp('nova@example.com', 'senha1234');

    expect(saveSession).toHaveBeenCalledWith(session);
    expect(result).toEqual({ success: true, navigateTo: 'dashboard' });
  });

  it('com sessão imediata mas saveSession falha: não retorna sinal de navegação', async () => {
    const supabaseAuth: SupabaseAuthClient = {
      async signInWithPassword() {
        throw new Error('not used');
      },
      async signUp(_credentials) {
        return { data: { session }, error: null };
      },
    };
    const storage: SecureStoragePort = {
      async saveSession() {
        throw new Error('SecureStore write failed');
      },
      async loadSession() {
        return null;
      },
      async clearSession() {},
    };

    const authManager = new AuthManager(supabaseAuth, storage);
    const result = await authManager.signUp('nova@example.com', 'senha1234');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('SecureStore write failed');
    }
  });
});
