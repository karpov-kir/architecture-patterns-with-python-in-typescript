import { AnyMessage, getMessageName, MessageHandler, toPrintableMessage } from '../../shared/Message';
import { ConstructorOf } from '../../types/ConstructorOf';
import { getOriginalConstructorName } from '../../utils';
import { MultiChannelPubSub } from './PubSub';

/**
 * I think that an in memory implementation is sufficient for internal messages only in simple cases.
 * So there is no port for this implementation because this implementation is not intended to be replaced (e.g. in tests).
 */
export class InMemoryMessageBus {
  private multiChannelPubSub = new MultiChannelPubSub<Map<ConstructorOf<AnyMessage>, MessageHandler<AnyMessage>>>();

  public subscribe<T extends AnyMessage>(Message: ConstructorOf<T>, handler: MessageHandler<T>) {
    console.log(`Subscribing ${getOriginalConstructorName(handler)} to message ${Message.name}`);

    this.multiChannelPubSub.subscribe(Message, handler as MessageHandler<AnyMessage>);

    return Promise.resolve();
  }

  public publish<T extends AnyMessage>(message: T): Promise<void> {
    console.log(`Publishing message ${getMessageName(message)}`, toPrintableMessage(message));
    return this.multiChannelPubSub.publish(message.constructor as ConstructorOf<AnyMessage>, message);
  }
}
