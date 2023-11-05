import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { TypeOrmConnectionPool } from '../../../infra/db/TypeOrmConnectionPool';
import { JustLogEmailService } from '../../../infra/JustLogEmailService';
import { sendAddBatchRequest, sendAllocateRequest } from '../../../tests/httpDriver';
import { BatchObjectMother } from '../../../tests/objectMothers/BatchObjectMother';
import { randomHash, waitForElementsInArray } from '../../../tests/utils';
import { CompositionRoot } from '../CompositionRoot';
import { WebServer } from '../WebServer';

const justLogEmailService = new JustLogEmailService();
const compositionRoot = await CompositionRoot.create({ emailService: justLogEmailService });

beforeAll(async () => {
  await compositionRoot.start();
});

afterAll(async () => {
  await compositionRoot.webServer.stop();
  await TypeOrmConnectionPool.destroy();
});

describe(WebServer.name, () => {
  describe('happy path', () => {
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

      expect(response.data).toEqual({
        batchReference: earliest.props.reference,
      });
    });
  });

  describe('unhappy path', () => {
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

    it('should return an out of stock error and send an out of stock email', async () => {
      const sku = randomHash('SMALL-TABLE');
      const batch = BatchObjectMother.default({ sku });

      await sendAddBatchRequest(batch);

      const response = await sendAllocateRequest({
        orderId: randomHash('order'),
        sku,
        quantity: batch.props.purchasedQuantity + 1,
      });

      await waitForElementsInArray(justLogEmailService.sentEmails);

      expect(response.status).toEqual(400);
      expect(response.data).toEqual({
        message: `Out of stock for SKU ${sku}`,
      });
      expect(justLogEmailService.sentEmails).toEqual([
        {
          to: 'admin@test.com',
          body: `Out of stock: ${sku}`,
        },
      ]);
    });
  });
});
