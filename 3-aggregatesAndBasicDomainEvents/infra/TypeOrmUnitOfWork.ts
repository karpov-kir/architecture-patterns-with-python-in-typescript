import { ProductRepository, UnitOfWorkPort } from '../useCases/UnitOfWork';
import { TypeOrmProductsRepository } from './db/TypeOrmProductsRepository';
import { TypeOrmSession } from './db/TypeOrmSession';
import { InMemoryMessageBus } from './pubSub/InMemoryMessageBus';

/**
 * This unit of work is now placed outside of the `db` folder, because it uses the database and the message bus.
 */
export class TypeOrmUnitOfWork implements UnitOfWorkPort {
  private constructor(
    public session: TypeOrmSession,
    public productRepository: ProductRepository,
    private messageBus: InMemoryMessageBus,
  ) {}

  public static async create(messageBus: InMemoryMessageBus): Promise<TypeOrmUnitOfWork> {
    const session = await TypeOrmSession.create();
    const productRepository = new TypeOrmProductsRepository(session);

    return new TypeOrmUnitOfWork(session, productRepository, messageBus);
  }

  private async publishEvents() {
    for (const product of this.productRepository.seen) {
      for (const event of product.events) {
        await this.messageBus.publish(event);
      }
    }
  }

  public async commit(): Promise<void> {
    if (this.session.isTransactionActive) {
      await this.session.commit();
    }

    await this.publishEvents();
  }

  public async rollback(): Promise<void> {
    if (!this.session.isTransactionActive) {
      return;
    }

    await this.session.rollback();
  }
}
