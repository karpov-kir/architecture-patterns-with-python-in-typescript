import { MessageBusPort } from '../../ports/MessageBusPort';
import { AnyMessage, getMessageName, MessageHandler, toPrintableMessage } from '../../shared/Message';
import { ConstructorOf } from '../../types/ConstructorOf';
import { getOriginalConstructorName } from '../../utils';
import { MultiChannelPubSub } from './PubSub';

export class InMemoryMessageBus implements MessageBusPort {
  private multiChannelPubSub = new MultiChannelPubSub<Map<ConstructorOf<AnyMessage>, MessageHandler<AnyMessage>>>();

  public subscribe<T extends AnyMessage>(Message: ConstructorOf<T>, handler: MessageHandler<T>) {
    console.log(
      `Subscribing ${getOriginalConstructorName(handler)} to message ${Message.name}`,
      `[${this.constructor.name}]`,
    );

    this.multiChannelPubSub.subscribe(Message, handler as MessageHandler<AnyMessage>);

    return Promise.resolve();
  }

  public publish<T extends AnyMessage>(message: T): Promise<void> {
    console.log(
      `Publishing message ${getMessageName(message)}`,
      toPrintableMessage(message),
      `[${this.constructor.name}]`,
    );
    return this.multiChannelPubSub.publish(message.constructor as ConstructorOf<AnyMessage>, message);
  }

  public async publishMany<T extends AnyMessage>(messages: ReadonlyArray<T>): Promise<void> {
    await Promise.all(messages.map((message) => this.publish(message)));
  }
}
