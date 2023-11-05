import { OutOfStockEvent } from '../domain/events/OutOfStockEvent';
import { EmailServicePort } from '../ports/EmailServicePort';
import { MessageHandler } from '../shared/Message';

export class SendOutOfStockEmailEventHandler implements MessageHandler<OutOfStockEvent> {
  constructor(private readonly emailService: EmailServicePort) {}

  public handle(event: OutOfStockEvent): Promise<void> {
    return this.emailService.sendEmail('admin@test.com', `Out of stock: ${event.props.sku}`);
  }
}
