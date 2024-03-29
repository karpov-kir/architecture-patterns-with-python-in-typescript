import { describe, expect, it } from 'bun:test';

import { AllocateCommand } from '../../domain/commands/AllocateCommand';
import { InMemoryMessageBus } from '../../infra/pubSub/InMemoryMessageBus';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { createFakeUnitOfWorkFactory, FakeUnitOfWork } from '../../tests/FakeUnitOfWork';
import { OrderLineObjectMother } from '../../tests/objectMothers/LineOrderObjectMother';
import { ProductObjectMother } from '../../tests/objectMothers/ProductObjectMother';
import { randomHash } from '../../tests/utils';
import { AllocateUseCase } from '../AllocateUseCase';

describe(AllocateUseCase.name, () => {
  it('should allocate', async () => {
    const unitOfWork = new FakeUnitOfWork();
    const sku = randomHash('SMALL-TABLE');
    const inStockProduct = ProductObjectMother.default({ sku });
    const inStockBatch = inStockProduct.props.batches[0];

    await unitOfWork.productRepository.save(inStockProduct);

    await new AllocateUseCase(createFakeUnitOfWorkFactory(unitOfWork), new InMemoryMessageBus()).handle(
      new AllocateCommand(OrderLineObjectMother.default({ sku }).props),
    );

    expect(inStockBatch.availableQuantity).toBe(20);
    expect(unitOfWork.isCommitted).toBe(true);
  });

  it('should throw a non existent sku error', async () => {
    const unitOfWork = new FakeUnitOfWork();
    let caughtError: unknown;

    await unitOfWork.productRepository.save(ProductObjectMother.default());

    try {
      await new AllocateUseCase(createFakeUnitOfWorkFactory(unitOfWork), new InMemoryMessageBus()).handle(
        new AllocateCommand(
          OrderLineObjectMother.default({
            sku: 'NON-EXISTING',
          }).props,
        ),
      );
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toEqual(
      new NotFoundError('Cannot allocate order line to product: no product with this SKU exists'),
    );
    expect(unitOfWork.isCommitted).toBe(false);
  });
});
