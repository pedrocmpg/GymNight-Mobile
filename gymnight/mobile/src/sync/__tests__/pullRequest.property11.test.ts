/**
 * Property 11: Pull request always sends the exact persisted last_pulled_at value
 *
 * **Validates: Requirements 4.3**
 *
 * Para qualquer timestamp Unix válido (inteiro positivo):
 * 1. Após saveLastPulledAt(timestamp), buildPullUrl(baseUrl, loadLastPulledAt())
 *    sempre produz uma URL contendo ?last_pulled_at=<exact_timestamp> — sem
 *    arredondamento, truncamento ou transformação.
 * 2. O valor na URL é o EXATO valor numérico persistido — parse de volta e é igual ao original.
 * 3. O timestamp nunca é modificado, normalizado ou arredondado durante o pipeline
 *    save → load → URL-build.
 * 4. Para qualquer sequência de saves, apenas o ÚLTIMO valor persistido é usado.
 */
import { fcAssert, fcProperty, fc } from '@/test/fcConfig';
import { buildPullUrl } from '../pullRequest';
import {
  loadLastPulledAt,
  saveLastPulledAt,
  clearLastPulledAt,
} from '../lastPulledAt';

const BASE_URL = 'https://api.gymnight.app/api/v1/sync/pull';

describe('Property 11: Pull request always sends the exact persisted last_pulled_at value', () => {
  beforeEach(() => {
    clearLastPulledAt();
  });

  it('save → load → buildPullUrl produces URL with exact timestamp (no rounding or truncation)', () => {
    fcAssert(
      fcProperty(
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (timestamp) => {
          // Save the timestamp
          saveLastPulledAt(timestamp);

          // Load it back
          const loaded = loadLastPulledAt();

          // Build the URL using the loaded value
          const url = buildPullUrl(BASE_URL, loaded);

          // The URL must contain the exact query parameter
          expect(url).toBe(`${BASE_URL}?last_pulled_at=${timestamp}`);

          // The value in the URL parsed back must equal the original
          const urlObj = new URL(url);
          const paramValue = urlObj.searchParams.get('last_pulled_at');
          expect(paramValue).not.toBeNull();
          expect(Number(paramValue)).toBe(timestamp);

          // Clean up for the next iteration
          clearLastPulledAt();
        },
      ),
    );
  });

  it('the value in the URL is the EXACT numeric value that was persisted — parse back equals original', () => {
    fcAssert(
      fcProperty(
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (timestamp) => {
          saveLastPulledAt(timestamp);
          const loaded = loadLastPulledAt();
          const url = buildPullUrl(BASE_URL, loaded);

          // Extract the numeric value from the URL and confirm round-trip fidelity
          const match = url.match(/last_pulled_at=(\d+)/);
          expect(match).not.toBeNull();
          const parsedBack = Number(match![1]);
          expect(parsedBack).toBe(timestamp);

          clearLastPulledAt();
        },
      ),
    );
  });

  it('timestamp is never modified, normalized, or rounded during save → load → URL-build pipeline', () => {
    fcAssert(
      fcProperty(
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (timestamp) => {
          saveLastPulledAt(timestamp);

          // Step 1: loaded value must be identical to saved value
          const loaded = loadLastPulledAt();
          expect(loaded).toBe(timestamp);

          // Step 2: URL value must be identical to loaded value
          const url = buildPullUrl(BASE_URL, loaded);
          const expectedUrl = `${BASE_URL}?last_pulled_at=${timestamp}`;
          expect(url).toBe(expectedUrl);

          // Step 3: string representation in URL must match string representation of original
          expect(url).toContain(`=${String(timestamp)}`);

          clearLastPulledAt();
        },
      ),
    );
  });

  it('for any sequence of saves, only the LATEST persisted value is used', () => {
    fcAssert(
      fcProperty(
        fc.array(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), {
          minLength: 2,
          maxLength: 10,
        }),
        (timestamps) => {
          // Perform a sequence of saves
          for (const ts of timestamps) {
            saveLastPulledAt(ts);
          }

          // Only the last one should be persisted
          const lastTimestamp = timestamps[timestamps.length - 1];
          const loaded = loadLastPulledAt();
          expect(loaded).toBe(lastTimestamp);

          // And the URL should use only that last value
          const url = buildPullUrl(BASE_URL, loaded);
          expect(url).toBe(`${BASE_URL}?last_pulled_at=${lastTimestamp}`);

          clearLastPulledAt();
        },
      ),
    );
  });
});
