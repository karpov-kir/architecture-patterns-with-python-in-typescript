import { Message } from '../../shared/Message';

interface AllocateCommandProps {
  orderId: string;
  sku: string;
  quantity: number;
}

export class AllocateCommand extends Message<AllocateCommandProps> {}
