import { Batch } from '../domain/Batch';
import { BatchRecord, fromPersistance } from '../infra/db/TypeOrmBatchRepository';
import { TypeOrmConnectionPool } from '../infra/db/TypeOrmConnectionPool';

export const rawInsertBatch = async (batch: Batch) => {
  const connection = await TypeOrmConnectionPool.getInstance();
  const [batchRecord] = await connection.query<BatchRecord[]>(
    `INSERT INTO batches (reference, sku, "purchasedQuantity", eta) VALUES ($1, $2, $3, $4) RETURNING *`,
    [batch.props.reference, batch.props.sku, batch.props.purchasedQuantity, batch.props.eta],
  );

  return fromPersistance(batchRecord);
};

export const rawGetAllocatedBatchRef = async (orderId: string, sku: string) => {
  const connection = await TypeOrmConnectionPool.getInstance();
  const [{ id: orderLineId }] = await connection.query<{ id: string }[]>(
    `SELECT id FROM "orderLines" WHERE "orderId"=$1 AND sku=$2`,
    [orderId, sku],
  );
  const [{ reference: batchReference }] = await connection.query<{ reference: string }[]>(
    `SELECT b.reference FROM allocations JOIN batches AS b ON "batchId" = b.id WHERE "orderLineId"=$1`,
    [orderLineId],
  );

  return batchReference;
};
