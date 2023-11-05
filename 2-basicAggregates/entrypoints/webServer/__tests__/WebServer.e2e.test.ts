import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { TypeOrmConnectionPool } from '../../../infra/db/TypeOrmConnectionPool';
import { sendAddBatchRequest, sendAllocateRequest } from '../../../tests/httpDriver';
import { BatchObjectMother } from '../../../tests/objectMothers/BatchObjectMother';
import { randomHash } from '../../../tests/utils';
import { WebServer } from '../WebServer';

const webServer = new WebServer();

beforeAll(async () => {
  await webServer.start();
});

afterAll(async () => {
  await webServer.stop();
  await TypeOrmConnectionPool.destroy();
});

describe(WebServer.name, () => {
  // Happy path
  it('should allocate a batch and return the batch reference', async () => {
    const sku = randomHash('SMALL-TABLE');
    const earliest = BatchObjectMother.withTomorrowsEta({ sku });
    const medium = BatchObjectMother.withAfterTomorrowsEta({ sku });
    const latest = BatchObjectMother.withLatestEta({ sku });

    await sendAddBatchRequest(medium);
    await sendAddBatchRequest(earliest);
    await sendAddBatchRequest(latest);

    const response = await sendAllocateRequest({
      orderId: randomHash('order'),
      sku,
      quantity: 3,
    });

    expect(await response.data).toEqual({
      batchReference: earliest.props.reference,
    });
  });

  // Unhappy path
  it('should return 400 when the sku is not found', async () => {
    const nonExistingSku = randomHash('NON-EXISTING');

    await sendAddBatchRequest(BatchObjectMother.default());

    const response = await sendAllocateRequest({
      orderId: randomHash('order'),
      sku: nonExistingSku,
      quantity: 3,
    });

    expect(response.status).toEqual(400);
    expect(response.data).toEqual({
      message: `Invalid SKU ${nonExistingSku}`,
    });
  });
});
