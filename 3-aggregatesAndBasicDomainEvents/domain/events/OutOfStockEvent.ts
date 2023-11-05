import { Message } from '../../shared/Message';

interface OutOfStockEventProps {
  sku: string;
}

export class OutOfStockEvent extends Message<OutOfStockEventProps> {}
