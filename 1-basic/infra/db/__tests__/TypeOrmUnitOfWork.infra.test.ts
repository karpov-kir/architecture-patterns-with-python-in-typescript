import { afterAll, describe, expect, it } from 'bun:test';

import { BatchObjectMother } from '../../../tests/objectMothers/BatchObjectMother';
import { OrderLineObjectMother } from '../../../tests/objectMothers/LineOrderObjectMother';
import { rawGetAllocatedBatchRef, rawInsertBatch } from '../../../tests/postgresDriver';
import { BatchRecord } from '../TypeOrmBatchRepository';
import { TypeOrmConnectionPool } from '../TypeOrmConnectionPool';
import { TypeOrmUnitOfWork } from '../TypeOrmUnitOfWork';

afterAll(async () => {
  await TypeOrmConnectionPool.destroy();
});

describe(TypeOrmUnitOfWork.name, () => {
  it('should retrieve a batch and allocate to it', async () => {
    const unitOfWork = await TypeOrmUnitOfWork.create();

    const rawInsertedBatch = await rawInsertBatch(BatchObjectMother.default());
    const orderLineToAllocate = OrderLineObjectMother.default();

    const batchFromRepo = await unitOfWork.batchRepository.get(rawInsertedBatch.props.reference);

    batchFromRepo.allocate(orderLineToAllocate);

    await unitOfWork.batchRepository.save(batchFromRepo);
    await unitOfWork.commit();

    const rawBatchReference = await rawGetAllocatedBatchRef(orderLineToAllocate.props.orderId, batchFromRepo.props.sku);
    expect(rawBatchReference).toEqual(batchFromRepo.props.reference);
  });

  it('should roll back an uncommitted transaction', async () => {
    const unitOfWork = await TypeOrmUnitOfWork.create();
    const connection = await TypeOrmConnectionPool.getInstance();

    const batch = BatchObjectMother.default();
    const orderLine = OrderLineObjectMother.default();

    batch.allocate(orderLine);

    await unitOfWork.batchRepository.save(batch);
    await unitOfWork.rollback();

    expect(
      await connection.query<BatchRecord[]>(`SELECT * FROM batches where reference = $1`, [batch.props.reference]),
    ).toEqual([]);
  });
});
