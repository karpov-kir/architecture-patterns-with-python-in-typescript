import crypto from 'crypto';

export const randomHash = (prefix?: string) =>
  [prefix, crypto.randomBytes(6).toString('hex')].filter(Boolean).join('-');

export const waitForElementsInArray = async (array: unknown[], timeoutMs = 2000) => {
  let passedMs = 0;
  const delay = 25;

  while (array.length === 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    passedMs += delay;

    if (passedMs >= timeoutMs) {
      throw new Error(`Timeout waiting for elements in an array`);
    }
  }
};

export const waitForResolution = async (checker: () => Promise<unknown>, attempts = 10, delay = 500) => {
  let latestError: unknown;

  while (attempts > 0) {
    try {
      await checker();
      return;
    } catch (error) {
      latestError = error;
    }

    attempts--;

    if (attempts > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Timeout waiting for resolution, latest error: ${latestError}`);
};
