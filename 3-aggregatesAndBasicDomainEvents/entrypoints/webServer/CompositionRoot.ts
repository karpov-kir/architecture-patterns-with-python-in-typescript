import { OutOfStockEvent } from '../../domain/events/OutOfStockEvent';
import { JustLogEmailService } from '../../infra/JustLogEmailService';
import { InMemoryMessageBus } from '../../infra/pubSub/InMemoryMessageBus';
import { TypeOrmUnitOfWork } from '../../infra/TypeOrmUnitOfWork';
import { EmailServicePort } from '../../ports/EmailServicePort';
import {
  AnyMessage,
  LogDecorator,
  MessageHandler,
  NotFailDecorator,
  RunInBackgroundDecorator,
} from '../../shared/Message';
import { ConstructorOf } from '../../types/ConstructorOf';
import { SendOutOfStockEmailEventHandler } from '../../useCases/SendOutOfStockEmailEventHandler';
import { UnitOfWorkPort } from '../../useCases/UnitOfWork';
import { addDecorators } from '../../utils';
import { AddBatchController } from './controllers/AddBatchController';
import { AllocateController } from './controllers/AllocateController';
import { WebServer } from './WebServer';

interface Dependencies {
  unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  emailService: EmailServicePort;
  messageBus: InMemoryMessageBus;
}

export class CompositionRoot {
  public readonly unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  public readonly emailService: EmailServicePort;
  public readonly webServer: WebServer;
  public readonly messageBus: InMemoryMessageBus;

  public static async create(dependencies: Partial<Dependencies> = {}) {
    const messageBus = dependencies.messageBus || new InMemoryMessageBus();
    const unitOfWorkFactory = dependencies.unitOfWorkFactory || (() => TypeOrmUnitOfWork.create(messageBus));
    const emailService = dependencies.emailService || new JustLogEmailService();

    return new CompositionRoot({ unitOfWorkFactory, emailService, messageBus });
  }

  public async start() {
    await this.webServer.start();
  }

  private constructor({ unitOfWorkFactory, emailService, messageBus }: Dependencies) {
    this.unitOfWorkFactory = unitOfWorkFactory;
    this.emailService = emailService;
    this.webServer = this.createWebServer();
    this.messageBus = messageBus;

    this.subscribeToMessages();
  }

  private createWebServer() {
    return new WebServer({
      addBatchControllerFactory: () => new AddBatchController(this.unitOfWorkFactory),
      allocateControllerFactory: () => new AllocateController(this.unitOfWorkFactory),
    });
  }

  private subscribeToMessages() {
    const mapping: Array<[ConstructorOf<AnyMessage>, MessageHandler<AnyMessage>]> = [
      [OutOfStockEvent, new SendOutOfStockEmailEventHandler(this.emailService)],
    ];

    for (const [Event, handler] of mapping) {
      this.messageBus.subscribe(
        Event,
        addDecorators(handler, [LogDecorator, NotFailDecorator, RunInBackgroundDecorator]),
      );
    }
  }
}
