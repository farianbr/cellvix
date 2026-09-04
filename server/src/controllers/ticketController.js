import { asyncHandler } from '../utils/ApiError.js';
import * as ticketService from '../services/ticketService.js';
import auditService from '../services/auditService.js';

/**
 * Repair tickets (Sales § Ticket).
 *
 * Thin, like every controller here. The two rules worth not routing around live
 * in the service: a status move always lands on the ticket timeline, and the
 * estimate is an estimate — nothing in this path bills anyone.
 */

const listTickets = asyncHandler(async (req, res) => {
  res.json(await ticketService.listTickets(req.query));
});

const getTicket = asyncHandler(async (req, res) => {
  res.json(await ticketService.getTicket(req.params.id));
});

const createTicket = asyncHandler(async (req, res) => {
  res.status(201).json(await ticketService.createTicket(req.body, req.user._id));
});

const updateTicket = asyncHandler(async (req, res) => {
  res.json(await ticketService.updateTicket(req.params.id, req.body));
});

const setTicketStatus = asyncHandler(async (req, res) => {
  res.json(await ticketService.setTicketStatus(req.params.id, req.body, req.user._id));
});

/**
 * Deleting a ticket destroys the repair history for a device, so it is audited
 * with actor and IP — the ticket number is recorded because after this call it
 * is the only trace left of what was removed.
 */
const deleteTicket = asyncHandler(async (req, res) => {
  const result = await ticketService.deleteTicket(req.params.id);

  await auditService.record({
    req,
    action: 'ticket.delete',
    entity: { kind: 'ticket', id: req.params.id, label: result.ticketNumber ?? '' },
    description: `Deleted ticket ${result.ticketNumber ?? req.params.id}.`,
  });

  res.json(result);
});

export { listTickets, getTicket, createTicket, updateTicket, setTicketStatus, deleteTicket };
