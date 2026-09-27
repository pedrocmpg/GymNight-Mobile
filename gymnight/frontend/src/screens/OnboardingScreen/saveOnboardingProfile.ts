import { Database, Q } from '@nozbe/watermelondb';
import database from '../../db/database';
import { serializeGoals } from './onboardingDomain';

export interface OnboardingProfileData {
  name: string;
  weight: number;
  height: number;
  gender: string;
  goals: string[];
  trainingTime: string;
}

export type SaveOnboardingProfileResult = { success: true } | { success: false; error: Error };

/**
 * Grava o perfil do onboarding na tabela `users` — upsert: atualiza a linha
 * se ela já existe localmente (ex: sincronizada de outra sessão), cria uma
 * nova caso contrário.
 *
 * ⚠️ O caminho de CRIAÇÃO é o que de fato inaugura a linha `users` deste
 * usuário, tanto localmente quanto no backend (via sync push) — nenhum outro
 * fluxo do app cria essa linha hoje (o endpoint REST `POST /users` do
 * backend nunca é chamado pelo mobile; tudo passa pelo protocolo de sync
 * genérico, que já aceita `created` para `users` com `id === current_user_id`
 * — ver `_push_users` em sync.py). Por isso o `id` é forçado para `userId`
 * (sobrescrevendo o UUID aleatório que `collection.create()` geraria) — sem
 * isso, o perfil nunca bateria com o dono real da sessão.
 *
 * `email` só é necessário no caminho de criação (`users.email` é obrigatório
 * no schema); ao atualizar uma linha existente, o email já está lá.
 *
 * `goal` é serializado como CSV (até 2 valores) — ver onboardingDomain.ts.
 *
 * Validates: PARIDADE-04-ROTINAS-PERFIL.md §2.3
 */
export async function saveOnboardingProfile(
  userId: string,
  email: string,
  data: OnboardingProfileData,
  db: Database = database,
): Promise<SaveOnboardingProfileResult> {
  try {
    await db.write(async () => {
      const existing = (await db
        .get('users')
        .query(Q.where('id', userId))
        .fetch()) as unknown as Array<{
        update: (fn: (r: { _raw: Record<string, unknown> }) => void) => Promise<unknown>;
      }>;

      const goalCsv = serializeGoals(data.goals);

      if (existing.length > 0) {
        await existing[0].update((record) => {
          record._raw.name = data.name;
          record._raw.weight = data.weight;
          record._raw.height = data.height;
          record._raw.gender = data.gender;
          record._raw.goal = goalCsv;
          record._raw.training_time = data.trainingTime;
          record._raw.updated_at = Date.now();
        });
      } else {
        await db.get('users').create((record: { _raw: Record<string, unknown> }) => {
          record._raw.id = userId;
          record._raw.name = data.name;
          record._raw.email = email;
          record._raw.weight = data.weight;
          record._raw.height = data.height;
          record._raw.gender = data.gender;
          record._raw.goal = goalCsv;
          record._raw.training_time = data.trainingTime;
          record._raw.created_at = Date.now();
          record._raw.updated_at = Date.now();
        });
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
