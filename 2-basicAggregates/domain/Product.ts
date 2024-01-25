import { Aggregate } from '../shared/Aggregate';
import { UnprocessableInputError } from '../shared/errors/UnprocessableInputError';
import { Batch } from './Batch';
import { OrderLine } from './OrderLine';

export interface ProductProperties {
  version: number;
  sku: string;
  batches: Batch[];
}

export class Product extends Aggregate<ProductProperties> {
  public greaterThan = undefined;

  constructor(props: ProductProperties) {
    super({
      ...props,
      batches: props.batches.toSorted((a, b) => (a.greaterThan(b) ? 1 : -1)),
    });
  }

  public hash(): string {
    return this.props.sku;
  }

  public allocate(orderLine: OrderLine): Batch {
    const batches = this.props.batches;

    if (this.props.sku !== orderLine.props.sku) {
      throw new UnprocessableInputError(`Invalid SKU ${orderLine.props.sku}`);
    }

    for (const batch of batches) {
      try {
        batch.allocate(orderLine);
        this._props.version++;
        return batch;
      } catch (error) {}
    }

    throw new UnprocessableInputError('Cannot allocate an order line to a batch: out of stock');
  }

  public addBatch(batch: Batch) {
    if (batch.props.sku !== this.props.sku) {
      throw new UnprocessableInputError(`All product's batches must have the same sku as the product`);
    }

    this._props.version++;
    this._props.batches.push(batch);
  }
}
