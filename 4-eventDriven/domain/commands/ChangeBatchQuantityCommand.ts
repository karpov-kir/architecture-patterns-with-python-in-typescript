import { Message } from '../../shared/Message';

interface ChangeBatchQuantityCommandProps {
  batchReference: string;
  quantity: number;
}

export class ChangeBatchQuantityCommand extends Message<ChangeBatchQuantityCommandProps> {}
