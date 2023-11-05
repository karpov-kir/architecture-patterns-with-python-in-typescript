import { Message } from '../../shared/Message';

interface DeallocatedEventProps {
  orderId: string;
  sku: string;
  quantity: number;
}

export class DeallocatedEvent extends Message<DeallocatedEventProps> {}
