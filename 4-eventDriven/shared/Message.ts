import pRetry from 'p-retry';

import { getOriginalConstructorName } from '../utils';
import { ValueObject } from './ValueObject';

export abstract class Message<
  T extends Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >,
> extends ValueObject<T> {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMessage = Message<any>;

export interface MessageHandler<T extends AnyMessage> {
  handle: (message: T) => Promise<void> | undefined;
}

export const getMessageName = (message: AnyMessage) => {
  return message.constructor.name;
};

export const toPrintableMessage = (message: AnyMessage) => {
  const data: {
    props: Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    meta?: Record<string | symbol, unknown>;
  } = {
    props: message.props,
  };

  if (Object.keys(message.meta).length > 0 || Object.getOwnPropertySymbols(message.meta).length > 0) {
    data.meta = message.meta;
  }

  return data;
};

/**
 * This decorator is used to:
 * - avoid an error in the handler prevents the other handlers from being executed
 * - avoid an error in the handler breaks the main execution flow
 */
export class NotFailDecorator<T extends AnyMessage> implements MessageHandler<T> {
  constructor(private readonly handler: MessageHandler<T>) {}

  public async handle(message: T): Promise<void> {
    try {
      await this.handler.handle(message);
    } catch (error) {
      console.error(`Could not handle message ${getMessageName(message)}`, toPrintableMessage(message), error);
    }
  }
}

/**
 * This decorator is used to:
 * - run all handlers in background to avoid the main request being delayed because of some side effects (e.g. sending an email)
 */
export class RunInBackgroundDecorator<T extends AnyMessage> implements MessageHandler<T> {
  constructor(private readonly handler: MessageHandler<T>) {}

  public async handle(message: T): Promise<void> {
    this.handler.handle(message);
  }
}

export class LogDecorator<T extends AnyMessage> implements MessageHandler<T> {
  constructor(private readonly handler: MessageHandler<T>) {}

  public async handle(message: T): Promise<void> {
    console.log(
      `Handling message ${getMessageName(message)}`,
      toPrintableMessage(message),
      `with handler ${getOriginalConstructorName(this.handler)}`,
    );

    await this.handler.handle(message);
  }
}

export class RetryDecorator<T extends AnyMessage> implements MessageHandler<T> {
  constructor(private readonly handler: MessageHandler<T>) {}

  public async handle(message: T): Promise<void> {
    pRetry(() => this.handler.handle(message), {
      retries: 3,
      onFailedAttempt: (error) => {
        if (error.retriesLeft === 0) {
          return;
        }

        console.error(
          `Attempt ${error.attemptNumber} to handle ${getMessageName(message)}`,
          toPrintableMessage(message),
          `with ${getOriginalConstructorName(this.handler)} has failed, there are ${
            error.retriesLeft
          } retries left, error:`,
          error,
        );
      },
    });
  }
}
