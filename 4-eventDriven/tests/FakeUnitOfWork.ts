import { InMemoryMessageBus } from '../infra/pubSub/InMemoryMessageBus';
import { AnyMessage } from '../shared/Message';
import { UnitOfWorkPort } from '../useCases/UnitOfWork';
import { FakeProductRepository } from './FakeProductRepository';

export class FakeUnitOfWork implements UnitOfWorkPort {
  public isCommitted: boolean = false;

  constructor(
    public readonly productRepository = new FakeProductRepository([]),
    public readonly messageBus = new InMemoryMessageBus(),
  ) {}

  public collectNewEvents() {
    const events: AnyMessage[] = [];

    for (const product of this.productRepository.seen) {
      for (const event of product.events) {
        events.push(event);
      }
    }

    return events;
  }

  public async commit(): Promise<void> {
    this.isCommitted = true;
  }

  public async rollback(): Promise<void> {}
}

export const createFakeUnitOfWorkFactory = (customFakeUnitOfWork?: FakeUnitOfWork) => () =>
  Promise.resolve(customFakeUnitOfWork || new FakeUnitOfWork());
