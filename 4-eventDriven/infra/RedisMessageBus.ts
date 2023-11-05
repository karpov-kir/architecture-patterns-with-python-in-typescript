import redis from 'redis';

import { MessageBusPort } from '../ports/MessageBusPort';
import { AnyMessage, getMessageName, MessageHandler, toPrintableMessage } from '../shared/Message';
import { ConstructorOf } from '../types/ConstructorOf';
import { getOriginalConstructorName } from '../utils';

type RedisClient = ReturnType<typeof redis.createClient>;

export class RedisMessageBus implements MessageBusPort {
  private static instancePromises?: Promise<{
    publisherInstance: RedisClient;
    subscriberInstance: RedisClient;
  }>;

  public static async destroy() {
    if (!this.instancePromises) {
      console.warn('Trying to destroy a message bus that is not initialized');
      return;
    }

    const { publisherInstance, subscriberInstance } = await this.instancePromises;

    await Promise.all([publisherInstance.quit(), subscriberInstance.quit()]);

    this.instancePromises = undefined;
  }

  public static async create(): Promise<RedisMessageBus> {
    if (!this.instancePromises) {
      const host = process.env.REDIS_HOST ?? '127.0.0.1';
      const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;

      const publisherInstance = redis.createClient({
        name: 'MessageBusPublisher',
        // redis[s]://[[username][:password]@][host][:port][/db-number]
        url: `redis://${host}:${port}`,
      });
      const subscriberInstance = publisherInstance.duplicate({
        name: 'MessageBusSubscriber',
      });

      this.instancePromises = Promise.all(
        [publisherInstance, subscriberInstance].map((instance) => instance.connect()),
      ).then(([publisherInstance, subscriberInstance]) => ({ publisherInstance, subscriberInstance }));
    }

    const { publisherInstance, subscriberInstance } = await this.instancePromises;

    return new RedisMessageBus(publisherInstance, subscriberInstance);
  }

  private constructor(
    private readonly publisher: RedisClient,
    private readonly subscriber: RedisClient,
  ) {}

  public async subscribe<T extends AnyMessage>(
    Message: ConstructorOf<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: MessageHandler<any>,
  ) {
    console.log(
      `Subscribing ${getOriginalConstructorName(handler)} to message ${Message.name} [${this.constructor.name}]`,
    );

    const redisHandler = (message: string) => {
      handler.handle(new Message(JSON.parse(message)));
    };

    await this.subscriber.subscribe(Message.name, redisHandler);
  }

  public async publish<T extends AnyMessage>(message: T): Promise<void> {
    console.log(
      `Publishing message ${getMessageName(message)}`,
      toPrintableMessage(message),
      `[${this.constructor.name}]`,
    );

    await this.publisher.publish(getMessageName(message), JSON.stringify(message.props));
  }

  public async publishMany<T extends AnyMessage>(messages: ReadonlyArray<T>): Promise<void> {
    await Promise.all(messages.map((message) => this.publish(message)));
  }
}
