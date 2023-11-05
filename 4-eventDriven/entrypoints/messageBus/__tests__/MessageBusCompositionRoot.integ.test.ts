import { afterAll, describe, expect, it } from 'bun:test';

import { AddBatchCommand } from '../../../domain/commands/AddBatchCommand';
import { AllocateCommand } from '../../../domain/commands/AllocateCommand';
import { ChangeBatchQuantityCommand } from '../../../domain/commands/ChangeBatchQuantityCommand';
import { TypeOrmConnectionPool } from '../../../infra/db/TypeOrmConnectionPool';
import { getOrderAllocations } from '../../../infra/db/views/GetOrderAllocations';
import { InMemoryMessageBus } from '../../../infra/pubSub/InMemoryMessageBus';
import { BatchObjectMother } from '../../../tests/objectMothers/BatchObjectMother';
import { rawGetAllocatedBatchRef, rawGetBatchRefs } from '../../../tests/postgresDriver';
import { randomHash, waitForResolution } from '../../../tests/utils';
import { MessageBusCompositionRoot } from '../MessageBusCompositionRoot';

const externalMessageBus = new InMemoryMessageBus();

const messageBusCompositionRoot = await MessageBusCompositionRoot.create({
  externalMessageBus,
});

await messageBusCompositionRoot.start();

afterAll(async () => {
  await TypeOrmConnectionPool.destroy();
});

describe(MessageBusCompositionRoot.name, () => {
  describe('views', () => {
    it('should update the allocations view on allocation', async () => {
      const sku1 = randomHash('SMALL-TABLE-1');
      const inStockSku1Batch = BatchObjectMother.default({ sku: sku1 });

      const sku2 = randomHash('SMALL-TABLE-2');
      const tomorrowsSku2Batch = BatchObjectMother.withTomorrowsEta({ sku: sku2 });

      const order1Id = randomHash('order-1');
      const order2Id = randomHash('order-2');

      await Promise.all([
        externalMessageBus.publish(new AddBatchCommand(inStockSku1Batch.props)),
        externalMessageBus.publish(new AddBatchCommand(tomorrowsSku2Batch.props)),
      ]);

      // External commands are executed in background, so we need to wait for the result.
      await waitForResolution(async () => {
        const refs = [...(await rawGetBatchRefs(sku1)), ...(await rawGetBatchRefs(sku2))];

        if (refs.length !== 2) {
          throw new Error('Not all batches were added');
        }
      });

      await Promise.all([
        externalMessageBus.publish(
          new AllocateCommand({
            orderId: order1Id,
            sku: sku1,
            quantity: 5,
          }),
        ),
        externalMessageBus.publish(
          new AllocateCommand({
            orderId: order1Id,
            sku: sku2,
            quantity: 5,
          }),
        ),
        externalMessageBus.publish(
          new AllocateCommand({
            orderId: order2Id,
            sku: sku1,
            quantity: 5,
          }),
        ),
      ]);

      await waitForResolution(async () => {
        const refs = [
          await rawGetAllocatedBatchRef(order1Id, sku1),
          await rawGetAllocatedBatchRef(order1Id, sku2),
          await rawGetAllocatedBatchRef(order2Id, sku1),
        ];

        if (refs.length !== 3) {
          throw new Error('Not all allocations are finished');
        }
      });

      const order1Allocations = await getOrderAllocations(order1Id, await TypeOrmConnectionPool.getInstance());
      const order2Allocations = await getOrderAllocations(order2Id, await TypeOrmConnectionPool.getInstance());

      expect(order1Allocations).toBeArrayOfSize(2);
      expect(order1Allocations).toContainEqual({
        batchReference: inStockSku1Batch.props.reference,
        sku: sku1,
      });
      expect(order1Allocations).toContainEqual({
        batchReference: tomorrowsSku2Batch.props.reference,
        sku: sku2,
      });

      expect(order2Allocations).toBeArrayOfSize(1);
      expect(order2Allocations).toContainEqual({
        batchReference: inStockSku1Batch.props.reference,
        sku: sku1,
      });
    });

    it('should update the allocations view on deallocation', async () => {
      const orderId = randomHash('order-1');
      const sku = randomHash('SMALL-TABLE-1');
      const inStockSku1Batch = BatchObjectMother.default({ sku });
      const tomorrowsSku1Batch = BatchObjectMother.withTomorrowsEta({ sku });

      await Promise.all([
        externalMessageBus.publish(new AddBatchCommand(inStockSku1Batch.props)),
        externalMessageBus.publish(new AddBatchCommand(tomorrowsSku1Batch.props)),
      ]);

      await waitForResolution(async () => {
        const refs = await rawGetBatchRefs(sku);

        if (refs.length !== 2) {
          throw new Error('Not all batches were added');
        }
      });

      await externalMessageBus.publish(
        new AllocateCommand({
          orderId,
          sku,
          quantity: inStockSku1Batch.props.purchasedQuantity - 5,
        }),
      );

      await waitForResolution(async () => {
        const ref = await rawGetAllocatedBatchRef(orderId, sku);

        if (!ref) {
          throw new Error('Allocation is not finished');
        }
      });

      await externalMessageBus.publish(
        new ChangeBatchQuantityCommand({
          batchReference: inStockSku1Batch.props.reference,
          quantity: 5,
        }),
      );

      await waitForResolution(async () => {
        const orderAllocations = await getOrderAllocations(orderId, await TypeOrmConnectionPool.getInstance());

        if (
          orderAllocations.length !== 1 ||
          orderAllocations[0].batchReference !== tomorrowsSku1Batch.props.reference
        ) {
          throw new Error('Deallocation has not been taken effect on the view');
        }
      });
    });
  });
});
