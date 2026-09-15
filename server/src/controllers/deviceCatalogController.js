import { asyncHandler } from '../utils/ApiError.js';
import * as deviceCatalogService from '../services/deviceCatalogService.js';
import auditService from '../services/auditService.js';
import '../models/DeviceCatalog.js';
import '../models/Ticket.js';
import '../models/ServiceQuote.js';

/**
 * The devices a service business takes in (Sales § Ticket, § Quote).
 *
 * Thin, like every controller here. The rules worth not routing around live in
 * the service: a node's kind follows from its parent rather than the request, a
 * slug never changes on a rename, and a device in use is retired rather than
 * deleted.
 */

const getTree = asyncHandler(async (req, res) => {
  res.json(await deviceCatalogService.getTree({ ...req.query, business: req.businessScope }));
});

const listNodes = asyncHandler(async (req, res) => {
  res.json(await deviceCatalogService.listNodes({ ...req.query, business: req.businessScope }));
});

const createNode = asyncHandler(async (req, res) => {
  res.status(201).json(await deviceCatalogService.createNode(req.body, req.businessScope));
});

const updateNode = asyncHandler(async (req, res) => {
  res.json(await deviceCatalogService.updateNode(req.params.id, req.body));
});

/**
 * Only ever possible for a leaf nothing references, so no history is lost - but
 * it is still the device list changing, and the name is recorded because after
 * this call nothing else holds it.
 */
const deleteNode = asyncHandler(async (req, res) => {
  const result = await deviceCatalogService.deleteNode(req.params.id);

  await auditService.record({
    req,
    action: 'device.delete',
    entity: { kind: 'device', id: req.params.id, label: result.name ?? '' },
    description: `Removed "${result.name ?? req.params.id}" from the device list.`,
  });

  res.json(result);
});

export { getTree, listNodes, createNode, updateNode, deleteNode };
export default { getTree, listNodes, createNode, updateNode, deleteNode };
