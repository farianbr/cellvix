/**
 * The Cellvix supplier master agreement, as supplied by the client.
 *
 * **The wording is theirs and is reproduced verbatim.** This is a contract, not
 * copy - a clause paraphrased to read better is a clause that no longer says
 * what the business agreed to. The only editorial change is structural: the
 * paper form's numbered headings become `title`, the paragraph under each
 * becomes `body`, and the "Supplier Notes / Exceptions" and initials lines are
 * dropped because the portal renders those as fields rather than as blanks.
 *
 * Bodies carry no Markdown: nothing in the source is emphasised, and adding
 * emphasis to a contract changes how it reads.
 */
const AGREEMENT_PREAMBLE = `This Supply Agreement ("Agreement") establishes the terms, conditions, and operational standards governing transactions between the Buyer and Supplier.`;

const AGREEMENT_CLAUSES = [
  {
    key: 'defects-video-warranty',
    title: 'Defective Products and Video Warranty Verification',
    body: 'The Buyer may submit clear video or photo evidence demonstrating functional or cosmetic defects in place of physically returning items. Upon receipt of valid video proof, the Supplier must immediately issue a credit note or include replacement units in the subsequent shipment at no additional cost to the Buyer.',
  },
  {
    key: 'moq-protection',
    title: 'Minimum Order Quantity (MOQ) Protection',
    body: 'The agreed Minimum Order Quantity (MOQ) established in the initial purchase order shall remain fixed for all repeat orders throughout the term of this Agreement. The Supplier shall not arbitrarily increase unit MOQs for standard reorders without prior written consent from the Buyer.',
  },
  {
    key: 'custom-packaging',
    title: 'Custom Packaging Specifications',
    body: 'Packaging must strictly follow the Buyer’s specifications based on the agreed MOQ. The default packaging standard is a plain white box with the Buyer’s branded product sticker affixed to the exterior top surface. If customized packaging incurs additional manufacturing costs, such costs must be mutually discussed, negotiated, and approved in writing before production.',
  },
  {
    key: 'shipping-damage',
    title: 'Shipping Damage Liability and Claims',
    body: 'The Supplier assumes full financial and operational responsibility for any goods damaged, lost, or compromised during transit. The Supplier is responsible for filing, managing, and resolving all claims directly with the freight forwarder or shipping carrier, ensuring the Buyer is fully refunded or compensated with replacement inventory without delay.',
  },
  {
    key: 'ddp-terms',
    title: 'Delivery Duty Paid (DDP) Terms',
    body: "All shipments shall be fulfilled strictly under Delivered Duty Paid (DDP) terms (Incoterms 2020) to the Buyer's designated destination. The Supplier and their designated freight forwarder bear full responsibility for all export/import clearance, customs tariffs, duties, brokerage fees, and local taxes. No supplementary tax or destination fees will be accepted by the Buyer.",
  },
  {
    key: 'payment-audits',
    title: 'Payment Terms and Factory Audits',
    body: 'All initial transactions and orders shall be conducted and secured exclusively through Alibaba Trade Assurance. Upon successful completion of initial performance periods, the Buyer reserves the right to conduct an on-site factory audit/visit to evaluate direct purchasing and alternative commercial payment arrangements.',
  },
  {
    key: 'nda',
    title: 'Non-Disclosure and Confidentiality (NDA)',
    body: 'The Supplier shall keep strictly confidential all proprietary business information, brand designs, product specifications, custom tooling, pricing structures, and commercial terms shared by the Buyer. The Supplier shall not reproduce, display, market, or sell the Buyer’s branded items or proprietary assets to any third party.',
  },
  {
    key: 'dispute-resolution',
    title: 'Dispute Resolution via Alibaba Platform',
    body: 'In the event of any contractual breach, quality dispute, fulfillment failure, or commercial disagreement that cannot be resolved through direct negotiation, both parties agree to escalate the matter directly to Alibaba Trade Assurance / Dispute Resolution services. Both parties agree to abide by Alibaba’s formal findings and settlement determinations.',
  },
  {
    key: 'term-commitment',
    title: 'Agreement Term and Commitment Binding',
    body: 'This Agreement remains valid and legally binding for a period of one (1) full year from the Effective Date. The Supplier agrees that pricing commitments, quality standards, and service level agreements agreed upon under this document shall not be altered, renegotiated unilaterally, or revoked under any circumstances during this term.',
  },
].map((clause) => ({ ...clause, requiresInitials: true }));

const AGREEMENT_TEMPLATE = {
  name: 'Supplier Master Services and Supply Agreement',
  description:
    'The standard agreement for a parts supplier - defect handling, MOQ, packaging, DDP shipping, confidentiality and dispute resolution.',
  preamble: AGREEMENT_PREAMBLE,
  clauses: AGREEMENT_CLAUSES,
  buyerSignatory: {
    name: 'Mohammed Sulaiman, MD Samiul Islam',
    title: 'Director',
    company: 'CellVix INC',
    /**
     * A placeholder mark, so the demo shows an executed document.
     *
     * Deliberately a drawn squiggle rather than anybody's real handwriting: a
     * seed file that shipped a director's actual signature would be a copy of
     * it in the repository, and the point of the row is that the buyer block
     * renders signed rather than blank. Replaced the moment somebody draws
     * their own on the Purchase Terms screen.
     */
    signatureImage:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA8CAYAAAAjW/WRAAAB50lEQVR4nO3ZQXLcIBAF0LlJNjlA7n85Z5HxJi6NJARNQ79X5TXw4UuM/HoBAAAAAAAAzPLr95+vT3+z5wfTnJVDUSjrTjmUhFLOCqAglHXn8CsJpbQceCWhhCcHXUlycyV+6GmAws/Jx5VOeoQm+Fx8heykZ1BCz+GsBEpy0YiABD7PnYOvIBdEFETocVoOvf06MDIYgcfzkaWj0YEIPE6vq5I9e4u6ewo8Rq+c7ddbZBACH2fEg658SaIDKB/426evSy25jLwFlN2zWQsvG/igf9aNviKX3K+o3x1Xx44Yd7aWchxl1fPt0zr33mOkMbMcn+YQOX60q4e5V4Gi1jBqrClmhHp3PjPmMVrvq1Omt3/EmENlCfbO/GbOp7demWfZv9njP5btiXMm89x62HFtS69ppXJ8W2GOLXZc02v1da1Siv+tOu8ju6zjyO7rS+nuj9LMb8os8xgpU95ljChJ9MbNHj9KhqzLWrUk1Q6MkixoZkkqHpS7WVfMKKXoklR+kp49lGa/2TkQtSk2vv1aPHve5UVsjE3/RzkWNmqDbPxPSrGgERvmALCV3iVRELbTqyTKwbaeHm7lYHuth9yPT8poOejKQSlX3wjeHJR19t1eOSjPf4HhhHLABYoBAAAAAACh/gL2HP3lkdYo0gAAAABJRU5ErkJggg==',
  },
};

export { AGREEMENT_CLAUSES, AGREEMENT_PREAMBLE, AGREEMENT_TEMPLATE };
export default AGREEMENT_TEMPLATE;
