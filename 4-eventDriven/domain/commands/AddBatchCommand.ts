import { Message } from '../../shared/Message';
import { ReadonlyDate } from '../../types/DeepReadonly';

interface AddBatchCommandProps {
  reference: string;
  sku: string;
  purchasedQuantity: number;
  eta?: ReadonlyDate;
}

export class AddBatchCommand extends Message<AddBatchCommandProps> {}
