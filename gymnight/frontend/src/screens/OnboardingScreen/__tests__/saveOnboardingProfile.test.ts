/**
 * saveOnboardingProfile — upsert em `users` (Wave 8, PARIDADE-04-ROTINAS-
 * PERFIL.md §2.3): cria a linha quando ela ainda não existe localmente
 * (forçando `id = userId`, sobrescrevendo o UUID aleatório que
 * `collection.create()` geraria), ou atualiza a existente.
 */
import { saveOnboardingProfile, type OnboardingProfileData } from '../saveOnboardingProfile';
import { makeFakeWorkoutDb } from '@/test/mocks/fakeWorkoutDb';

function profile(overrides: Partial<OnboardingProfileData> = {}): OnboardingProfileData {
  return {
    name: 'Pedro',
    weight: 80,
    height: 178,
    gender: 'Masculino',
    goals: ['Hipertrofia', 'Saúde'],
    ...overrides,
  };
}

describe('saveOnboardingProfile — criação (linha ainda não existe localmente)', () => {
  it('cria a linha com id igual ao userId (não um UUID aleatório)', async () => {
    const { db, tables } = makeFakeWorkoutDb();
    const result = await saveOnboardingProfile('user-42', 'pedro@example.com', profile(), db);
    expect(result.success).toBe(true);

    const rows = [...tables.users.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]._raw.id).toBe('user-42');
  });

  it('grava email, nome, peso, altura, gênero e goal serializado', async () => {
    const { db, tables } = makeFakeWorkoutDb();
    await saveOnboardingProfile('user-1', 'pedro@example.com', profile(), db);

    const row = [...tables.users.values()][0];
    expect(row._raw.email).toBe('pedro@example.com');
    expect(row._raw.name).toBe('Pedro');
    expect(row._raw.weight).toBe(80);
    expect(row._raw.height).toBe(178);
    expect(row._raw.gender).toBe('Masculino');
    expect(row._raw.goal).toBe('Hipertrofia,Saúde');
  });

  it('objetivo vazio serializa como string vazia, não null/undefined', async () => {
    const { db, tables } = makeFakeWorkoutDb();
    await saveOnboardingProfile('user-1', 'pedro@example.com', profile({ goals: [] }), db);
    expect([...tables.users.values()][0]._raw.goal).toBe('');
  });
});

describe('saveOnboardingProfile — atualização (linha já existe localmente)', () => {
  it('atualiza a linha existente em vez de criar uma segunda', async () => {
    const { db, tables } = makeFakeWorkoutDb({
      users: [{ id: 'existing-1', _raw: { id: 'user-1', name: '', email: 'pedro@example.com' } }],
    });

    const result = await saveOnboardingProfile('user-1', 'pedro@example.com', profile(), db);
    expect(result.success).toBe(true);
    expect(tables.users.size).toBe(1);
  });

  it('preserva o email já existente (não sobrescreve com string vazia)', async () => {
    const { db, tables } = makeFakeWorkoutDb({
      users: [{ id: 'existing-1', _raw: { id: 'user-1', name: '', email: 'original@example.com' } }],
    });

    // email passado aqui é irrelevante no caminho de atualização — só é usado ao criar.
    await saveOnboardingProfile('user-1', '', profile(), db);

    const row = [...tables.users.values()][0];
    expect(row._raw.email).toBe('original@example.com');
    expect(row._raw.name).toBe('Pedro');
  });
});

describe('saveOnboardingProfile — falhas', () => {
  it('propaga falha como {success: false, error} em vez de lançar', async () => {
    const failingDb = {
      write: async () => {
        throw new Error('boom');
      },
    } as unknown as Parameters<typeof saveOnboardingProfile>[3];

    const result = await saveOnboardingProfile('user-1', 'a@b.com', profile(), failingDb);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('boom');
    }
  });
});
