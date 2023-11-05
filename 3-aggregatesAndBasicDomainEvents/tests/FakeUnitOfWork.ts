import { InMemoryMessageBus } from '../infra/pubSub/InMemoryMessageBus';
import { UnitOfWorkPort } from '../useCases/UnitOfWork';
import { FakeProductRepository } from './FakeProductRepository';

export class FakeUnitOfWork implements UnitOfWorkPort {
  public isCommitted: boolean = false;

  constructor(
    public readonly productRepository = new FakeProductRepository([]),
    public readonly messageBus = new InMemoryMessageBus(),
  ) {}

  private async publishEvents() {
    for (const product of this.productRepository.seen) {
      for (const event of product.events) {
        await this.messageBus.publish(event);
      }
    }
  }

  public async commit(): Promise<void> {
    this.isCommitted = true;
    await this.publishEvents();
  }

  public async rollback(): Promise<void> {}
}
