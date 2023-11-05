import { Product } from '../domain/Product';
import { MessageBusPort } from '../ports/MessageBusPort';
import { AnyMessage, MessageHandler } from '../shared/Message';

export interface UnitOfWorkPort {
  productRepository: ProductRepository;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  collectNewEvents: () => AnyMessage[];
}

export interface ProductRepository {
  save(product: Product): Promise<void>;
  find(sku: string): Promise<Product | undefined>;
  get(sku: string): Promise<Product>;
  getByBatchReference(batchReference: string): Promise<Product>;
  seen: Product[];
}

export abstract class CommandHandlerUseCase<T extends AnyMessage> implements MessageHandler<T> {
  constructor(
    protected readonly unitOfWorkFactory: () => Promise<UnitOfWorkPort>,
    protected readonly internalMessageBus: MessageBusPort,
  ) {}

  #unitOfWork?: UnitOfWorkPort;

  protected get unitOfWork(): UnitOfWorkPort {
    if (!this.#unitOfWork) {
      throw new Error('UnitOfWork is not initialized');
    }

    return this.#unitOfWork;
  }

  protected abstract execute(command: T): Promise<void>;

  public async handle(command: T): Promise<void> {
    this.#unitOfWork = await this.unitOfWorkFactory();

    try {
      await this.execute(command);
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }
  }

  public async commitAndPublishEvents(): Promise<void> {
    await this.unitOfWork.commit();
    await this.internalMessageBus.publishMany(this.unitOfWork.collectNewEvents());
  }
}
