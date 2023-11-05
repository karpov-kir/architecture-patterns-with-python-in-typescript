import { Message } from '../../shared/Message';

interface AllocatedEventProps {
  orderId: string;
  sku: string;
  quantity: number;
  batchReference: string;
}

export class AllocatedEvent extends Message<AllocatedEventProps> {}
