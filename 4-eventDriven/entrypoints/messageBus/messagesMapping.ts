import { AddBatchCommand } from '../../domain/commands/AddBatchCommand';
import { AllocateCommand } from '../../domain/commands/AllocateCommand';
import { ChangeBatchQuantityCommand } from '../../domain/commands/ChangeBatchQuantityCommand';
import { AllocatedEvent } from '../../domain/events/AllocatedEvent';
import { DeallocatedEvent } from '../../domain/events/DeallocatedEvent';
import { OutOfStockEvent } from '../../domain/events/OutOfStockEvent';
import { AddOrderAllocationToReadModelEventHandler } from '../../infra/db/views/AddOrderAllocationToReadModelEventHandler';
import { RemoveAllocationFromReadModelEventHandler } from '../../infra/db/views/RemoveAllocationFromReadModelEventHandler';
import { MessageBusPort } from '../../ports/MessageBusPort';
import {
  AnyMessage,
  LogDecorator,
  MessageHandler,
  NotFailDecorator,
  RetryDecorator,
  RunInBackgroundDecorator,
} from '../../shared/Message';
import { ConstructorOf } from '../../types/ConstructorOf';
import { AddBatchUseCase } from '../../useCases/AddBatchUseCase';
import { AllocateUseCase } from '../../useCases/AllocateUseCase';
import { ChangeBatchQuantityUseCase } from '../../useCases/ChangeBatchQuantityUseCase';
import { SendOutOfStockEmailEventHandler } from '../../useCases/SendOutOfStockEmailEventHandler';
import { addDecorators, Decorator } from '../../utils';
import {
  PromoteToExternalAndPublishEventHandler,
  TranslateEventToCommandEventHandler,
} from './MessageBusCompositionRoot';

export interface UseCases {
  changeBatchQuantityUseCaseFactory: () => ChangeBatchQuantityUseCase;
  allocateUseCaseFactory: () => AllocateUseCase;
  addBatchUseCaseFactory: () => AddBatchUseCase;
}

export interface MessageHandlers {
  sendOutOfStockEmailEventHandlerFactory: () => SendOutOfStockEmailEventHandler;
  promoteToExternalAndPublishEventHandlerFactory: () => PromoteToExternalAndPublishEventHandler;
  addOrderAllocationToReadModelEventHandlerFactory: () => AddOrderAllocationToReadModelEventHandler;
  removeAllocationFromReadModelEventHandlerFactory: () => RemoveAllocationFromReadModelEventHandler;
  createTranslateEventToCommandEventHandler: <FromEvent extends AnyMessage, ToCommand extends AnyMessage>(
    translator: (event: FromEvent) => ToCommand,
  ) => TranslateEventToCommandEventHandler<FromEvent, ToCommand>;
}

export const subscribeToExternalMessages = async (externalMessageBus: MessageBusPort, useCases: UseCases) => {
  /**
   * Use cases are exposed via commands from an external message bus. It's useful because it:
   * - Improves testability
   * - Allows the use cases to be invoked by external systems without having to call the web server
   *   - This enables services to follow temporal decoupling (e.g. a fire and forget strategy)
   */
  const externalCommandsMapping: Array<[ConstructorOf<AnyMessage>, () => MessageHandler<AnyMessage>]> = [
    [AddBatchCommand, useCases.addBatchUseCaseFactory],
    [AllocateCommand, useCases.allocateUseCaseFactory],
    [ChangeBatchQuantityCommand, useCases.changeBatchQuantityUseCaseFactory],
  ];

  await subscribeToMessages(
    externalMessageBus,
    externalCommandsMapping,
    // Re. used decorators. Commands execute business logic, but since they are invoked externally and we want to have temporal decoupling,
    // the external services should just fire a command to be executed and forget, and we should try our best to execute the command.
    // This is why `RetryDecorator`, `NotFailDecorator`, and `RunInBackgroundDecorator` are used.
    // If a command cannot be executed it should be reported somewhere (e.g. a monitoring system or a dead letter queue) and investigated.
    // TODO maybe we still should await the command execution to simplify testing?
    [LogDecorator, RetryDecorator, NotFailDecorator, RunInBackgroundDecorator],
  );
};

export const subscribeToInternalMessages = async (
  internalMessageBus: MessageBusPort,
  useCases: UseCases,
  eventHandlers: MessageHandlers,
) => {
  /**
   * Use cases are exposed via commands from an internal message bus. It's useful because it:
   * - Improves testability
   * - Allows the use cases to be easily mounted to the web server routes (routes just emit internal commands)
   * - Makes use cases simple command handlers
   */
  const internalCommandsMapping: Array<[ConstructorOf<AnyMessage>, () => MessageHandler<AnyMessage>]> = [
    [AddBatchCommand, useCases.addBatchUseCaseFactory],
    [AllocateCommand, useCases.allocateUseCaseFactory],
  ];

  /**
   * Event handlers are subscribed to internal events. It's useful because it:
   * - Improves testability
   * - Allows to move side effects to event handlers from the core business logic
   */
  const importantInternalEventsMapping: Array<[ConstructorOf<AnyMessage>, () => MessageHandler<AnyMessage>]> = [
    [AllocatedEvent, eventHandlers.addOrderAllocationToReadModelEventHandlerFactory],
    [DeallocatedEvent, eventHandlers.removeAllocationFromReadModelEventHandlerFactory],
    [
      DeallocatedEvent,
      () =>
        eventHandlers.createTranslateEventToCommandEventHandler(
          (event: DeallocatedEvent) =>
            new AllocateCommand({
              orderId: event.props.orderId,
              sku: event.props.sku,
              quantity: event.props.quantity,
            }),
        ),
    ],
  ];
  const internalEventsMapping: Array<[ConstructorOf<AnyMessage>, () => MessageHandler<AnyMessage>]> = [
    [OutOfStockEvent, eventHandlers.sendOutOfStockEmailEventHandlerFactory],
    [AllocatedEvent, eventHandlers.promoteToExternalAndPublishEventHandlerFactory],
  ];

  await Promise.all([
    subscribeToMessages(
      internalMessageBus,
      internalCommandsMapping,
      // Re. used decorators. Commands execute business logic, but since they are invoked internally we want them to fail
      // and propagate the error to the caller, that's why `NotFailDecorator` and `RunInBackgroundDecorator` are NOT used.
      [LogDecorator],
    ),

    subscribeToMessages(
      internalMessageBus,
      importantInternalEventsMapping,
      // Re. used decorators. Even important events should not break the main execution flow,
      // but we still want to await them, to ensure they take effect before the flow is finished,
      // that's why `NotFailDecorator` is used and `RunInBackgroundDecorator` is NOT used.
      [LogDecorator, NotFailDecorator],
    ),

    subscribeToMessages(
      internalMessageBus,
      internalEventsMapping,
      // Re. used decorators. We don't want some event handlers to block or break the main execution flow,
      // that's why `NotFailDecorator` and `RunInBackgroundDecorator` are used.
      [LogDecorator, NotFailDecorator, RunInBackgroundDecorator],
    ),
  ]);
};

class MessageHandlerExecutor implements MessageHandler<AnyMessage> {
  constructor(
    private readonly handlerFactory: () => MessageHandler<AnyMessage>,
    private readonly decorators: Decorator[],
  ) {}

  handle(message: AnyMessage): Promise<void> | undefined {
    const handler = addDecorators(this.handlerFactory(), this.decorators);

    return handler.handle(message);
  }
}

const subscribeToMessages = async (
  messageBus: MessageBusPort,
  eventsMapping: Array<[ConstructorOf<AnyMessage>, () => MessageHandler<AnyMessage>]>,
  decorators: Decorator[],
) => {
  for (const [Event, handlerFactory] of eventsMapping) {
    await messageBus.subscribe(Event, new MessageHandlerExecutor(handlerFactory, decorators));
  }
};
