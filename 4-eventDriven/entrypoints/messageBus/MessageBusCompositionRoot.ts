import { TypeOrmUnitOfWork } from '../../infra/db/TypeOrmUnitOfWork';
import { AddOrderAllocationToReadModelEventHandler } from '../../infra/db/views/AddOrderAllocationToReadModelEventHandler';
import { RemoveAllocationFromReadModelEventHandler } from '../../infra/db/views/RemoveAllocationFromReadModelEventHandler';
import { JustLogEmailService } from '../../infra/JustLogEmailService';
import { InMemoryMessageBus } from '../../infra/pubSub/InMemoryMessageBus';
import { RedisMessageBus } from '../../infra/RedisMessageBus';
import { EmailServicePort } from '../../ports/EmailServicePort';
import { MessageBusPort } from '../../ports/MessageBusPort';
import { AnyMessage, MessageHandler } from '../../shared/Message';
import { AddBatchUseCase } from '../../useCases/AddBatchUseCase';
import { AllocateUseCase } from '../../useCases/AllocateUseCase';
import { ChangeBatchQuantityUseCase } from '../../useCases/ChangeBatchQuantityUseCase';
import { SendOutOfStockEmailEventHandler } from '../../useCases/SendOutOfStockEmailEventHandler';
import { UnitOfWorkPort } from '../../useCases/UnitOfWork';
import { MessageHandlers, subscribeToExternalMessages, subscribeToInternalMessages, UseCases } from './messagesMapping';

export interface MessageBusCompositionRootDependencies {
  unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  internalMessageBus: MessageBusPort;
  externalMessageBus: MessageBusPort;
  emailService: EmailServicePort;
}

export class MessageBusCompositionRoot {
  public readonly unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  public readonly internalMessageBus: MessageBusPort;
  public readonly externalMessageBus: MessageBusPort;
  public readonly emailService: EmailServicePort;

  public static async create(dependencies: Partial<MessageBusCompositionRootDependencies> = {}) {
    const internalMessageBus = dependencies.internalMessageBus || new InMemoryMessageBus();
    const externalMessageBus = dependencies.externalMessageBus || (await RedisMessageBus.create());
    const unitOfWorkFactory = dependencies.unitOfWorkFactory || (() => TypeOrmUnitOfWork.create());
    const emailService = dependencies.emailService || new JustLogEmailService();

    return new MessageBusCompositionRoot({ unitOfWorkFactory, internalMessageBus, externalMessageBus, emailService });
  }

  private constructor({
    unitOfWorkFactory,
    internalMessageBus,
    externalMessageBus,
    emailService,
  }: MessageBusCompositionRootDependencies) {
    this.unitOfWorkFactory = unitOfWorkFactory;
    this.internalMessageBus = internalMessageBus;
    this.externalMessageBus = externalMessageBus;
    this.emailService = emailService;
  }

  public async start() {
    await this.subscribeToMessages();
  }

  private async subscribeToMessages() {
    const useCases: UseCases = {
      changeBatchQuantityUseCaseFactory: () =>
        new ChangeBatchQuantityUseCase(this.unitOfWorkFactory, this.internalMessageBus),
      allocateUseCaseFactory: () => new AllocateUseCase(this.unitOfWorkFactory, this.internalMessageBus),
      addBatchUseCaseFactory: () => new AddBatchUseCase(this.unitOfWorkFactory, this.internalMessageBus),
    };

    const createTranslateEventToCommandEventHandler = <FromEvent extends AnyMessage, ToCommand extends AnyMessage>(
      translator: (event: FromEvent) => ToCommand,
    ) => new TranslateEventToCommandEventHandler<FromEvent, ToCommand>(this.internalMessageBus, translator);

    const eventHandlers: MessageHandlers = {
      sendOutOfStockEmailEventHandlerFactory: () => new SendOutOfStockEmailEventHandler(this.emailService),
      promoteToExternalAndPublishEventHandlerFactory: () =>
        new PromoteToExternalAndPublishEventHandler(this.externalMessageBus),
      addOrderAllocationToReadModelEventHandlerFactory: () => new AddOrderAllocationToReadModelEventHandler(),
      removeAllocationFromReadModelEventHandlerFactory: () => new RemoveAllocationFromReadModelEventHandler(),
      createTranslateEventToCommandEventHandler,
    };

    await Promise.all([
      subscribeToExternalMessages(this.externalMessageBus, useCases),
      subscribeToInternalMessages(this.internalMessageBus, useCases, eventHandlers),
    ]);
  }
}

const promotedToExternalSymbol = Symbol('promotedToExternal');

/**
 * It simply promotes and publishes an internal event to the outside world using the external message bus.
 */
export class PromoteToExternalAndPublishEventHandler {
  constructor(private readonly externalMessageBus: MessageBusPort) {}

  handle(event: AnyMessage): Promise<void> {
    event.meta[promotedToExternalSymbol] = true;
    return this.externalMessageBus.publish(event);
  }
}

export class TranslateEventToCommandEventHandler<FromEvent extends AnyMessage, ToCommand extends AnyMessage>
  implements MessageHandler<FromEvent>
{
  constructor(
    private readonly messageBus: MessageBusPort,
    private readonly translator: (event: FromEvent) => ToCommand,
  ) {}

  public async handle(event: FromEvent): Promise<void> {
    await this.messageBus.publish(this.translator(event));
  }
}
