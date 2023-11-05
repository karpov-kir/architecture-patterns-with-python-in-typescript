import { TypeOrmUnitOfWork } from '../../infra/db/TypeOrmUnitOfWork';
import { InMemoryMessageBus } from '../../infra/pubSub/InMemoryMessageBus';
import { MessageBusPort } from '../../ports/MessageBusPort';
import { UnitOfWorkPort } from '../../useCases/UnitOfWork';
import { AddBatchController } from './controllers/AddBatchController';
import { AllocateController } from './controllers/AllocateController';
import { GetOrderAllocationsController } from './controllers/GetOrderAllocationsController';
import { WebServer } from './WebServer';

export interface WebServerCompositionRootDependencies {
  unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  internalMessageBus: MessageBusPort;
}

export class WebServerCompositionRoot {
  public readonly unitOfWorkFactory: () => Promise<UnitOfWorkPort>;
  public readonly webServer: WebServer;
  public readonly internalMessageBus: MessageBusPort;

  public static async create(dependencies: Partial<WebServerCompositionRootDependencies> = {}) {
    const internalMessageBus = dependencies.internalMessageBus || new InMemoryMessageBus();
    const unitOfWorkFactory = dependencies.unitOfWorkFactory || (() => TypeOrmUnitOfWork.create());

    return new WebServerCompositionRoot({ unitOfWorkFactory, internalMessageBus });
  }

  private constructor({ unitOfWorkFactory, internalMessageBus }: WebServerCompositionRootDependencies) {
    this.internalMessageBus = internalMessageBus;
    this.unitOfWorkFactory = unitOfWorkFactory;

    this.webServer = this.createWebServer();
  }

  public async start() {
    this.webServer.start();
  }

  private createWebServer() {
    return new WebServer({
      addBatchControllerFactory: () => new AddBatchController(this.internalMessageBus),
      allocateControllerFactory: () => new AllocateController(this.internalMessageBus),
      getOrderAllocationsControllerFactory: () => new GetOrderAllocationsController(),
    });
  }
}
