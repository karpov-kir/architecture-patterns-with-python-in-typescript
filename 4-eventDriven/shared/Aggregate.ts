import { Entity } from './Entity';
import { AnyMessage } from './Message';

export abstract class Aggregate<
  P extends Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >,
> extends Entity<P> {
  protected _events: AnyMessage[] = [];

  public get events(): ReadonlyArray<AnyMessage> {
    return this._events;
  }
}
