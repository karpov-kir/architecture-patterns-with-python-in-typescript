import { FastifySchema } from 'fastify';

import { AddBatchController } from './controllers/AddBatchController';
import { AllocateController } from './controllers/AllocateController';
import { Controller } from './controllers/Controller';

export interface Route {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  schema?: FastifySchema;
  controllerFactory: () => Controller;
}

export const createRoutes = (): Route[] => {
  return [
    {
      path: '/add',
      method: 'POST',
      schema: {
        body: {
          type: 'object',
          required: ['reference', 'sku', 'purchasedQuantity'],
          properties: {
            reference: {
              type: 'string',
            },
            sku: {
              type: 'string',
            },
            purchasedQuantity: {
              type: 'number',
            },
            eta: {
              type: 'string',
            },
          },
        },
      },
      controllerFactory: () => new AddBatchController(),
    },
    {
      path: '/allocate',
      method: 'POST',
      schema: {
        body: {
          type: 'object',
          required: ['orderId', 'sku', 'quantity'],
          properties: {
            orderId: {
              type: 'string',
            },
            sku: {
              type: 'string',
            },
            quantity: {
              type: 'number',
            },
          },
        },
      },
      controllerFactory: () => new AllocateController(),
    },
  ];
};
