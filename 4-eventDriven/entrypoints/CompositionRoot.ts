import { TypeOrmUnitOfWork } from '../infra/db/TypeOrmUnitOfWork';
import { JustLogEmailService } from '../infra/JustLogEmailService';
import { InMemoryMessageBus } from '../infra/pubSub/InMemoryMessageBus';
import { RedisMessageBus } from '../infra/RedisMessageBus';
import {
  MessageBusCompositionRoot,
  MessageBusCompositionRootDependencies,
} from './messageBus/MessageBusCompositionRoot';
import { WebServerCompositionRoot, WebServerCompositionRootDependencies } from './webServer/WebServerCompositionRoot';

export interface CompositionRootDependencies
  extends MessageBusCompositionRootDependencies,
    WebServerCompositionRootDependencies {}

interface ChildrenCompositionRoots {
  webServerCompositionRoot: WebServerCompositionRoot;
  messageBusCompositionRoot: MessageBusCompositionRoot;
}

export class CompositionRoot {
  public readonly webServerCompositionRoot: WebServerCompositionRoot;
  public readonly messageBusCompositionRoot: MessageBusCompositionRoot;

  public static async create(dependencies: Partial<CompositionRootDependencies> = {}) {
    const internalMessageBus = dependencies.internalMessageBus || new InMemoryMessageBus();
    const externalMessageBus = dependencies.externalMessageBus || (await RedisMessageBus.create());
    const unitOfWorkFactory = dependencies.unitOfWorkFactory || (() => TypeOrmUnitOfWork.create());
    const emailService = dependencies.emailService || new JustLogEmailService();

    const finalDependencies: CompositionRootDependencies = {
      internalMessageBus,
      externalMessageBus,
      unitOfWorkFactory,
      emailService,
    };

    const messageBusCompositionRoot = await MessageBusCompositionRoot.create(finalDependencies);
    const webServerCompositionRoot = await WebServerCompositionRoot.create(finalDependencies);

    return new CompositionRoot({ webServerCompositionRoot, messageBusCompositionRoot });
  }

  private constructor({ webServerCompositionRoot, messageBusCompositionRoot }: ChildrenCompositionRoots) {
    this.webServerCompositionRoot = webServerCompositionRoot;
    this.messageBusCompositionRoot = messageBusCompositionRoot;
  }

  public async start() {
    await Promise.all([this.webServerCompositionRoot.start(), this.messageBusCompositionRoot.start()]);
  }
}
