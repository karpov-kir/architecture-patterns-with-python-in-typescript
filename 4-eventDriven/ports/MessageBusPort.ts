import { AnyMessage, MessageHandler } from '../shared/Message';
import { ConstructorOf } from '../types/ConstructorOf';

export interface MessageBusPort {
  subscribe<T extends AnyMessage>(Message: ConstructorOf<T>, handler: MessageHandler<T>): Promise<void>;
  publish<T extends AnyMessage>(message: T): Promise<void>;
  publishMany<T extends AnyMessage>(message: ReadonlyArray<T>): Promise<void>;
}
