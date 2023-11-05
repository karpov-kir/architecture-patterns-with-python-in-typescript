import { Batch } from '../domain/Batch';
import { TypeOrmConnectionPool } from '../infra/db/TypeOrmConnectionPool';
import { BatchRecord, ProductRecord } from '../infra/db/TypeOrmProductsRepository';

export const rawInsertProduct = async (sku: string) => {
  const connection = await TypeOrmConnectionPool.getInstance();
  const [productRecord] = await connection.query<ProductRecord[]>(
    `INSERT INTO products (sku, version) VALUES ($1, $2) RETURNING *`,
    [sku, 1],
  );

  return productRecord;
};

export const rawInsertBatch = async (batch: Batch) => {
  const connection = await TypeOrmConnectionPool.getInstance();
  const [_batchRecord] = await connection.query<BatchRecord[]>(
    `INSERT INTO batches (reference, sku, "purchasedQuantity", eta) VALUES ($1, $2, $3, $4) RETURNING *`,
    [batch.props.reference, batch.props.sku, batch.props.purchasedQuantity, batch.props.eta],
  );
};

export const rawGetBatchRefs = async (sku: string) => {
  const connection = await TypeOrmConnectionPool.getInstance();
  const refs = await connection.query<{ reference: string }[]>(`SELECT reference FROM batches WHERE sku=$1`, [sku]);

  return refs.map(({ reference }) => reference);
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
