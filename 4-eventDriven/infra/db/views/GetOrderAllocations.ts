import { TypeOrmConnectionPool } from '../TypeOrmConnectionPool';

export const getOrderAllocations = (orderId: string, connectionPool: TypeOrmConnectionPool) => {
  const orderAllocations = connectionPool.query<
    Array<{
      batchReference: string;
      sku: string;
    }>
  >(`SELECT sku, "batchReference" FROM "allocationsView" WHERE "orderId" = $1`, [orderId]);

  return orderAllocations;
};
