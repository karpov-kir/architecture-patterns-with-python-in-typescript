import { AllocatedEvent } from '../../../domain/events/AllocatedEvent';
import { MessageHandler } from '../../../shared/Message';
import { TypeOrmConnectionPool } from '../TypeOrmConnectionPool';

export class AddOrderAllocationToReadModelEventHandler implements MessageHandler<AllocatedEvent> {
  public async handle(event: AllocatedEvent): Promise<void> {
    const connectionPool = await TypeOrmConnectionPool.getInstance();

    return connectionPool.query(
      `INSERT INTO "allocationsView" ("orderId", sku, "batchReference") VALUES ($1, $2, $3)`,
      [event.props.orderId, event.props.sku, event.props.batchReference],
    );
  }
}
