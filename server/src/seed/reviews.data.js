/**
 * Demo review copy.
 *
 * Written in the voice of a repair workshop rather than a consumer marketplace:
 * these are businesses buying parts to fit for their own customer, so what they
 * talk about is fitment, failure rate and whether the grade was honest. Nobody
 * says "amazing product" about a charging port.
 *
 * Every line is generic enough to sit under any component type. That is a
 * deliberate limit of seeded content: the copy is demo furniture, and writing
 * 2,000 part-specific opinions is not something a seed script can honestly do.
 * Where a phrase would be wrong for a whole category it is left out rather than
 * hedged - there is nothing here about screen colour, because it would read as
 * nonsense on a speaker.
 *
 * Grouped by rating so the generator can hand out a believable spread: mostly
 * fours and fives, a few threes, the occasional two. A catalogue where every
 * review is five stars is one nobody believes.
 */

const REVIEW_COPY = {
  5: [
    ['No returns in three months', 'Fitted a dozen of these since the spring and not one has come back. Exactly what the grade promised and the packaging held up in transit.'],
    ['Exactly what the grade says', 'Ordered expecting light marks and that is precisely what turned up. Tested before boxing as promised, and the customer never knew it was not new.'],
    ['This is the one we reorder', 'We have tried three suppliers on this part and stopped looking after this one. Consistent between batches, which is the thing that actually matters.'],
    ['Straight in, no fettling', 'Went in first time with no trimming and no adhesive drama. The workshop time saved pays for the difference against the cheap version.'],
    ['Dispatch was same day as promised', 'Ordered before two and it was on the van that afternoon. Arrived next morning and went straight onto a job that was waiting on it.'],
  ],
  4: [
    ['Good part, packaging could be tighter', 'The part itself is as graded and went in without trouble. Two arrived with the anti-static bag already split, which did no harm here but is worth watching.'],
    ['Solid for the money', 'Not quite the finish of the OEM part if you put them side by side, but nobody is doing that. For a budget repair it does the job and the margin works.'],
    ['Does what it says', 'No complaints. Fitted three, all working, customer happy. Would have been five if the first one had not needed the connector reseating.'],
    ['Reliable, if not remarkable', 'Ordered these four or five times now. Nothing has ever gone wrong and nothing has ever surprised me, which is what you want from a consumable.'],
    ['Would order again', 'Fit and finish are fine for the grade. Took a little longer to arrive than the last order but the desk flagged it before I had to chase.'],
  ],
  3: [
    ['Fine, but workshop test it first', 'Part works and the fit is right. One of the three had a slightly proud connector that needed reseating twice before it read. Worth testing before it goes in front of a customer.'],
    ['Acceptable at the price', 'Does the job. The finish is a shade off and one of the two had a mark that was outside what I would call the grade, though not enough to send back.'],
    ['Mixed batch', 'Three out of four were spot on. The fourth had an issue that cost me twenty minutes on the workshop, which on a job this size is the whole margin.'],
  ],
  2: [
    ['Not the grade I expected', 'The wear on this was heavier than the grade suggests. It went in and it works, but I would have quoted the customer differently had I known.'],
  ],
};

/**
 * Who is writing.
 *
 * Invented names and businesses, because a seeded review is putting words in
 * somebody's mouth and that somebody must not be a real business. Canadian
 * conventions throughout, matching the rest of the catalogue.
 */
const REVIEW_AUTHORS = [
  { name: 'Marc Lefebvre', business: 'Rue Wellington Repairs' },
  { name: 'Priya Raman', business: 'Downtown Device Clinic' },
  { name: 'Tom Okafor', business: 'Bayview Mobile' },
  { name: 'Sandra Chu', business: 'Harbourfront Phone Lab' },
  { name: 'Alex Boucher', business: 'Pointe-Claire Cellular' },
  { name: 'Nadia Haddad', business: 'Riverside Tech Repair' },
  { name: 'Jonas Reid', business: 'Kingsway Device Care' },
  { name: 'Mei Tanaka', business: 'Lakeshore Screen Shop' },
  { name: 'Dev Patel', business: 'Northgate Mobile Service' },
  { name: 'Erin Gallagher', business: 'Trinity Bellwoods Repairs' },
  { name: 'Yusuf Aziz', business: 'Sherbrooke Phone Works' },
  { name: 'Claire Dubois', business: 'Vieux-Port Device Repair' },
];

export { REVIEW_COPY, REVIEW_AUTHORS };
