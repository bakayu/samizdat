/**
 * Poll an async function until it succeeds or times out.
 * Useful for fetching newly created on-chain accounts that may not be immediately queryable.
 */
export async function pollUntilReady<T>(
  fn: () => Promise<T>,
  options: {
    interval?: number;
    timeout?: number;
    resourceName?: string;
  } = {}
): Promise<T> {
  const {
    interval = 200, // Poll every 200ms
    timeout = 3000, // Give up after 3 seconds
    resourceName = 'Account',
  } = options;

  const startTime = Date.now();

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const elapsed = Date.now() - startTime;

      if (elapsed >= timeout) {
        throw error;
        console.log(
          `${resourceName} could not be fetched after ${timeout}ms. ` +
            `The transaction may have succeeded, but the account is not yet queryable. ` +
            `Please refresh the page to try again.`
        );
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}
