import { asyncHandler } from '../utils/ApiError.js';
import * as blogService from '../services/blogService.js';
import * as faqService from '../services/faqService.js';
import * as offerService from '../services/offerService.js';

/**
 * Blog, FAQ and offers.
 *
 * Three small domains that share one shape — public read, admin write — so they
 * share a controller rather than three near-identical files. The services stay
 * separate; the business logic is where the domains actually differ.
 */

// ---- blog -------------------------------------------------------------------

const listPosts = asyncHandler(async (req, res) => {
  res.json(await blogService.listPublished(req.query));
});

const getPost = asyncHandler(async (req, res) => {
  res.json(await blogService.getBySlug(req.params.slug));
});

const adminListPosts = asyncHandler(async (req, res) => {
  res.json(await blogService.listAll(req.query));
});

const adminGetPost = asyncHandler(async (req, res) => {
  res.json({ post: await blogService.getById(req.params.id) });
});

const adminCreatePost = asyncHandler(async (req, res) => {
  res.status(201).json({ post: await blogService.createPost(req.body) });
});

const adminUpdatePost = asyncHandler(async (req, res) => {
  res.json({ post: await blogService.updatePost(req.params.id, req.body) });
});

const adminDeletePost = asyncHandler(async (req, res) => {
  res.json({ post: await blogService.deletePost(req.params.id) });
});

// ---- faq --------------------------------------------------------------------

const listFaqs = asyncHandler(async (req, res) => {
  res.json(await faqService.listGeneral(req.query));
});

const adminListFaqs = asyncHandler(async (req, res) => {
  res.json(await faqService.listAll(req.query));
});

const adminCreateFaq = asyncHandler(async (req, res) => {
  res.status(201).json({ faq: await faqService.createFaq(req.body) });
});

const adminUpdateFaq = asyncHandler(async (req, res) => {
  res.json({ faq: await faqService.updateFaq(req.params.id, req.body) });
});

const adminDeleteFaq = asyncHandler(async (req, res) => {
  res.json({ faq: await faqService.deleteFaq(req.params.id) });
});

// ---- offers -----------------------------------------------------------------

const listOffers = asyncHandler(async (req, res) => {
  // `req.user` may be null — the price gate inside decides what a guest sees.
  res.json(await offerService.listLive(req.user));
});

const getOffer = asyncHandler(async (req, res) => {
  res.json(await offerService.getBySlug(req.params.slug, req.user));
});

const adminListOffers = asyncHandler(async (req, res) => {
  res.json(await offerService.listAll(req.query));
});

const adminCreateOffer = asyncHandler(async (req, res) => {
  res.status(201).json({ offer: await offerService.createOffer(req.body) });
});

const adminUpdateOffer = asyncHandler(async (req, res) => {
  res.json({ offer: await offerService.updateOffer(req.params.id, req.body) });
});

const adminDeleteOffer = asyncHandler(async (req, res) => {
  res.json({ offer: await offerService.deleteOffer(req.params.id) });
});

export { listPosts, getPost, adminListPosts, adminGetPost, adminCreatePost, adminUpdatePost, adminDeletePost, listFaqs, adminListFaqs, adminCreateFaq, adminUpdateFaq, adminDeleteFaq, listOffers, getOffer, adminListOffers, adminCreateOffer, adminUpdateOffer, adminDeleteOffer };
