import { createBackendGymAiClient } from '../backendGymAiClient';
import { createMockGymAiClient } from '../mockGymAiClient';
import type { HttpResult } from '../../sync/syncCycleRunner';

const history = [{ role: 'user' as const, content: 'Como progredir no supino?' }];

function setup(result: HttpResult | (() => never)) {
  const post = jest.fn(async () => {
    if (typeof result === 'function') return result();
    return result;
  });
  const attachAuthHeader = jest.fn((req: any) => ({ ...req, headers: { Authorization: 'Bearer fixture' } }));
  const client = createBackendGymAiClient({
    backendBaseUrl: 'http://backend.fixture',
    http: { post } as any,
    authInterceptor: { attachAuthHeader } as any,
  });
  return { client, post, attachAuthHeader };
}

describe('backend GymAI client', () => {
  it('envia o histórico autenticado para /api/v1/chat e devolve a resposta', async () => {
    const { client, post } = setup({ kind: 'success', status: 200, body: { reply: 'Aumente 2,5 kg.' } });
    expect(await client.sendMessage(history)).toEqual({ success: true, reply: 'Aumente 2,5 kg.' });
    expect(post).toHaveBeenCalledWith(
      'http://backend.fixture/api/v1/chat',
      { messages: history },
      { Authorization: 'Bearer fixture' },
    );
  });

  it.each([
    [{ kind: 'network_error', error: new Error('x') }, 'offline'],
    [{ kind: 'success', status: 401, body: {} }, 'unauthorized'],
    [{ kind: 'success', status: 429, body: {} }, 'rate_limited'],
    [{ kind: 'success', status: 502, body: {} }, 'unavailable'],
    [{ kind: 'success', status: 200, body: {} }, 'unavailable'],
  ] as const)('mapeia %j para %s', async (http, reason) => {
    const { client } = setup(http as HttpResult);
    expect(await client.sendMessage(history)).toEqual({ success: false, reason });
  });

  it('sem sessão (interceptor lança) devolve unauthorized sem chamar a rede', async () => {
    const { client, post, attachAuthHeader } = setup({ kind: 'success', status: 200, body: {} });
    attachAuthHeader.mockImplementation(() => {
      throw new Error('sem token');
    });
    expect(await client.sendMessage(history)).toEqual({ success: false, reason: 'unauthorized' });
    expect(post).not.toHaveBeenCalled();
  });
});

describe('mock GymAI client', () => {
  it('responde de forma determinística, sem rede', async () => {
    expect(await createMockGymAiClient().sendMessage(history)).toEqual({
      success: true,
      reply: '[mock] Recebi: Como progredir no supino?',
    });
  });
  it('pode devolver um resultado fixo (ex.: offline)', async () => {
    const fixed = { success: false as const, reason: 'offline' as const };
    expect(await createMockGymAiClient(fixed).sendMessage(history)).toEqual(fixed);
  });
});
