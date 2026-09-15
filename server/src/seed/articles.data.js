/**
 * Article copy, one piece per COMPONENT TYPE.
 *
 * Articles are stored one per product, but they are written per component type
 * here, because that is the level the useful advice actually lives at: what
 * separates a good screen from a bad one is the same argument on an iPhone 13
 * and a Galaxy S24, and the part name is already on the page. The seeder
 * substitutes the model name into the heading so each product still carries a
 * heading about itself.
 *
 * `body` is plain text in the vocabulary `client/src/lib/richText.jsx` reads:
 * a blank line starts a paragraph, `##` a subheading, `-` a list item, and
 * `**bold**` inline. Never HTML - the renderer exists so admin-authored copy is
 * never trusted as markup (Instructions §8).
 *
 * The voice is the repair workshop, not the marketing desk. Every claim here is
 * one the desk could actually stand behind: what to look at, what fails, what
 * the grade means. Nothing invents a warranty, a statistic or a test result the
 * business does not have.
 */

const ARTICLES = {
  'screen-assembly': {
    heading: 'How to judge a replacement screen for the {model}',
    body: `A cracked panel is the most common job on a repair workshop, and the one where a cheap part costs you twice: it comes back as a warranty claim with your labour attached to it.

## What separates the grades

The visible difference is almost always the colour of black. An OEM panel renders black as black. A copy lifts it toward grey, and once you have the two side by side under bench light you will not need telling again.

- Touch response within about 3mm of the edge, where copies tend to go dead
- The colour of black against a panel you already trust
- Whether the ambient sensor tracks smoothly or steps in stages
- True Tone and auto-brightness behaviour after the swap

## What each grade is for

**NEW** and **OEM** go into a customer device you are warranting. **Pull A** is a tested panel off a working device with light cosmetic wear, which is the sensible choice for a screen that will sit under a case. **Pull B** carries visible marks and is usually a stopgap or a workshop spare. **Aftermarket** is the budget tier, and it is honest work at the price as long as the customer is told what they are getting.

## What we ship

Every panel is powered up and tested before it is boxed, not sampled by the pallet. The grade on the card is the grade in the box.`,
  },

  battery: {
    heading: 'Choosing a replacement battery for the {model}',
    body: `A battery is the part a customer notices most and inspects least. They will not look at it, but they will phone you in a fortnight if it does not hold.

## What actually matters

Rated capacity is the number on the label, and it is the least interesting thing about a cell. What matters is how it behaves at the ends of the charge.

- Cycle behaviour in the first month, which is where a weak cell shows itself
- Whether the health reading settles or drifts after a few charges
- Swelling under normal use, the failure that damages the screen above it
- How the cell handles a cold morning

## What each grade is for

**NEW** is a fresh cell and is what a warranted repair wants. **OEM** is the manufacturer's own part where we can source it. **Aftermarket** is the budget option; it is real work at a real price, but tell the customer it is what they are getting.

## What we ship

Cells are checked before boxing and shipped at a storage charge, not flat. We do not stock pulls in this category.`,
  },

  'charging-port': {
    heading: 'What to check on a {model} charging port',
    body: `Half the charging faults that reach a workshop are not the port at all. Before you order the part, rule out the cable, the customer's charger and a pocket full of lint.

## Before you replace it

- Clear the port properly and retest with a known-good cable
- Check whether data works when charging does not, which points elsewhere
- Look at the pins under magnification for corrosion or a lifted contact
- Confirm the fault follows the device rather than the charger

## What each grade is for

**NEW** and **OEM** flexes are what you want on a device you are warranting, because this is a part that sees mechanical stress every day of its life. **Pull A** is a tested flex off a working device and is a sound choice for an older handset where the economics are tight.

## What we ship

Ports are continuity-tested before boxing. Where the assembly includes a microphone or antenna line, that is tested too.`,
  },

  'back-glass': {
    heading: 'Replacing the back glass on a {model}',
    body: `Back glass is cosmetic until it is not. Once the seal is broken the device stops being water resistant, and on most modern handsets the glass is bonded hard enough that removal is a heat-and-patience job rather than a quick swap.

## Before you quote it

- Check whether the camera lens is part of the panel or separate
- Look for a cracked frame under the glass, which changes the job entirely
- Allow for the adhesive and the cure time, not just the part
- Warn the customer that water resistance is not restored by a glass swap

## What each grade is for

**NEW** is colour-matched replacement glass. **Aftermarket** is the budget tier and is usually a close rather than exact colour match, which matters more on the pale finishes than the black ones.

## What we ship

Glass is inspected for edge chips before boxing, because a chip at the edge becomes a crack the first time the panel is pressed home.`,
  },

  'rear-camera': {
    heading: 'What to look for in a {model} back camera',
    body: `A camera module is the part most often replaced unnecessarily. A great many "camera faults" are a cracked lens cover over a working module, which is a far cheaper fix.

## Before you order

- Check the lens cover separately from the module underneath
- Test every lens on a multi-camera device, not just the main one
- Look for shake or a rattle, which points at the stabiliser
- Confirm autofocus hunts rather than sits, which is a module fault

## What each grade is for

**OEM** is the manufacturer's part. **Pull A** is a tested module off a working device and is the usual choice here, because a camera that works, works. **Pull B** carries cosmetic wear on the housing that nobody will see once it is fitted.

## What we ship

Modules are fitted and photographed on a test rig before boxing. A module that will not focus does not leave the warehouse.`,
  },

  'front-camera': {
    heading: 'The {model} front camera, and what fails on it',
    body: `The front camera assembly usually carries more than a camera: the proximity sensor, the ambient light sensor and often the earpiece line run through the same flex. That is why a "camera" fault so often presents as a screen that will not sleep during a call.

## What to test after fitting

- The camera itself, front and rear, in both photo and video
- Proximity, by making a call and holding the device to your ear
- Auto-brightness, which shares the sensor cluster
- Face unlock where the device supports it, which many repairs break

## What each grade is for

**OEM** is the manufacturer's assembly. **Pull A** is a tested unit off a working device, and for this part it is a sound choice: the flex either passes its tests or it does not.

## What we ship

Assemblies are tested for camera, proximity and ambient response together, because on this part they are one component.`,
  },

  'flex-cable': {
    heading: 'Flex cables on the {model}, and why they fail',
    body: `A flex cable fails in one of two ways: it is damaged during a previous repair, or it wears where it bends. Both are worth knowing about before you order, because the second one tends to come back.

## Before you replace it

- Look for a pinch mark or a tear near the connector, which points at a previous repair
- Check the connector seat on the board for a lifted or missing pin
- Confirm the fault is constant rather than intermittent with movement
- Reseat the existing cable once before condemning it

## What each grade is for

**NEW** and **OEM** are what a warranted repair wants. **Pull A** is a tested cable off a working device and is fine on an older handset where a new part costs more than the phone is worth.

## What we ship

Cables are continuity-tested end to end before boxing, and the connector is inspected for lifted pins.`,
  },

  'loud-speaker': {
    heading: 'Speaker faults on the {model}',
    body: `Most speaker complaints are muffled output rather than silence, and muffled output is very often a blocked grille rather than a dead driver. Clean it first; you will save the customer a part.

## Before you order

- Clean the grille and retest at full volume
- Check whether the fault appears on speakerphone only, which points at a different driver
- Test with a media file rather than a ringtone, which may be routed differently
- Listen for distortion at volume, the usual sign of a failing driver

## What each grade is for

**NEW** is a fresh driver. **Pull A** is a tested unit off a working device, and speakers either sound right or they do not, so a tested pull is an easy choice on an older device.

## What we ship

Drivers are tested for output and distortion before boxing.`,
  },
};

export { ARTICLES };
export default ARTICLES;
