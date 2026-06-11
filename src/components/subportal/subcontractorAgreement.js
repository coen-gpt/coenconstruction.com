/**
 * Canonical Coen Construction LLC Subcontractor Agreement.
 *
 * Single source of truth for the digital packet: the onboarding portal renders
 * these sections for the sub to read and sign, and the exact same text (via
 * agreementPlainText) is sent to the server, stored on the Vendor record, and
 * emailed back to the sub as their copy — so what they saw, signed, and keep
 * can never drift apart.
 *
 * Bump AGREEMENT_VERSION whenever the wording changes; old signed records keep
 * the version they were signed under.
 */
export const AGREEMENT_VERSION = "2025.1";

export const AGREEMENT_TITLE = "Coen Construction LLC — Subcontractor Agreement";

export const AGREEMENT_INTRO =
  "This document is a binding contract and blanket agreement between Coen Construction LLC (\"Contractor\") and the undersigned (\"Subcontractor\"). It shall remain in force for fifteen (15) years from the date signed unless changed in writing by both parties. By signing, Subcontractor and Contractor agree to the following terms:";

export const AGREEMENT_SECTIONS = [
  {
    heading: "General Performance",
    body: "All work will be performed in a good and workmanlike manner in accordance with the plans, specifications, and Contractor's standard construction practices, and must comply with all Federal, State, county and municipal laws, codes, ordinances and regulations effective where the work is performed. All permits, fees, taxes and expenses connected with such compliance are paid by the Subcontractor. Subcontractor will furnish all materials, supplies, equipment, scaffolding and tools necessary to execute its work with due diligence and without delay, and will not interfere with the work of the Contractor or other subcontractors.",
  },
  {
    heading: "Independent Contractor",
    body: "The Subcontractor is hired solely as an Independent Contractor. Neither the Subcontractor nor its employees shall be deemed to be employees of the Contractor.",
  },
  {
    heading: "Time and Completion of Work",
    body: "Subcontractor agrees to begin work promptly when notified and to complete it in a professional and workmanlike manner within a reasonable time and by the deadlines established by the Contractor in writing. Subcontractor shall cooperate with other trades and at all times provide competent supervision, a sufficient number of skilled workers, and adequate and proper materials to maintain the Contractor's schedule. Subcontractor warrants it holds all licenses and permits necessary for the work. If the Contractor determines the work does not conform to the Drawings and Specifications or is not of satisfactory quality, and Subcontractor does not correct the defects within the Contractor's timetable, the Contractor may correct them and back-charge the Subcontractor for the cost.",
  },
  {
    heading: "Extras",
    body: "No deviations from the work specified in the contract will be permitted or paid for unless an Additional Work Authorization or Change Order and a Purchase Order is issued and signed.",
  },
  {
    heading: "Assignment",
    body: "No assignment of this subcontract agreement by the Subcontractor is permitted without the prior written permission of the Contractor.",
  },
  {
    heading: "Hold Harmless / Indemnification",
    body: "Subcontractor agrees to protect, defend, indemnify and hold harmless the Contractor and/or the property owner against any and all claims, demands, liabilities, losses, expenses, suits, actions, fines, penalties, assessments and attorney's fees on account of any injury to any person, any death, or any property damage arising out of or in connection with the work, even if alleged to be attributable in part to the Contractor. This includes any OSHA-issued fines or penalties attributable to the Subcontractor or its employees, agents or sub-subcontractors. If the Contractor reasonably believes the Subcontractor has caused or will cause a claim, lien, or penalty, the Contractor may withhold monies due and pay the Subcontractor and claimant jointly. Subcontractor agrees to reimburse the Contractor for all sums it may pay or be compelled to pay in settlement of any such claim.",
  },
  {
    heading: "Mechanic's Lien",
    body: "Subcontractor shall furnish all partial and final lien waivers, releases and sworn statements under the Massachusetts Mechanic's Lien Law, for itself and for all of its materialmen and suppliers, in a form acceptable to the Contractor as a condition precedent to partial and final payment. If any lien or claim of nonpayment is asserted against the Contractor's property arising out of the Subcontractor's work, the Subcontractor shall indemnify, defend and hold the Contractor harmless from all such liens and all related costs, fees and expenses (including attorney's fees). The Contractor may withhold payment as reasonably necessary to discharge any such lien, claim, fine, penalty or assessment.",
  },
  {
    heading: "Clean-Up",
    body: "Subcontractor agrees to clean up all debris, trash and refuse generated by its trade at the end of each day and deposit it into the trash bin provided, clean all walls, floors and finished surfaces soiled by its trade, and haul away or bin all boxes, crates and containers. Subcontractor shall leave each job site broom-clean for the next trade. If the Subcontractor fails to comply after verbal notice and an opportunity to correct, the Contractor may back-charge the cost of debris removal and cleanup.",
  },
  {
    heading: "Default / Termination",
    body: "If the Subcontractor defaults in the performance of any of its duties or obligations, the Contractor may immediately terminate this Agreement and finish the Subcontractor's work by whatever method it deems expedient; the Subcontractor is due only such sums for approved work up to termination, less any offsets or amounts due the Contractor, and shall furnish lien waivers upon termination and payment. The Contractor may also terminate or suspend the work at any time for its convenience and without cause, paying the Subcontractor for the Subcontract Work performed. Upon notice of termination the Subcontractor shall cease operations as directed, take actions necessary to protect and preserve the work, and terminate its own sub-subcontracts and purchase orders. The Contractor is entitled to recover its court costs, expenses and reasonable attorney's fees in enforcing its rights under this Agreement.",
  },
  {
    heading: "Care of Materials",
    body: "Subcontractor agrees to be diligent in the proper care of materials supplied by the Contractor. Usable materials are to be stored in an orderly way that protects them from wind and moisture and provides general site safety; non-usable materials are to be culled and properly disposed of in the bins provided. The Contractor may back-charge the Subcontractor for the cost of materials it deems damaged by negligent Subcontractor care. Subcontractor shall promptly notify the Contractor of any defects in materials supplied by the Contractor.",
  },
  {
    heading: "Payment",
    body: "The Contractor will provide stated time frames for the Subcontractor to submit invoices. Invoices not received by the stated time will be processed and paid in the next pay period. Invoices in question will be held in their entirety until the disputed charge is resolved, and a disputed charge may be held from the Subcontractor's total payment regardless of the specific project in dispute. Payment terms are 30 days from review and approval of all invoices (roughly 30–45 days from submission to payment). Every invoice must include all of the following or it will not be accepted: (1) Coen-provided PO #, (2) date of submission, (3) job name and address, (4) Subcontractor/Vendor name, (5) invoice number (5 digits or more), (6) dollar amount, and (7) description of work. All invoices must be submitted electronically to coenconstruction@gmail.com; paper invoices are no longer accepted.",
  },
  {
    heading: "Insurance",
    body: "Prior to commencing work, the Subcontractor shall purchase and maintain: Workers' Compensation at statutory limits and Employers Liability ($500,000 each accident, $500,000 disease–employee, $500,000 disease–policy limit); Commercial General Liability written on an occurrence basis ($2,000,000 general aggregate, $2,000,000 products/completed-operations aggregate, $1,000,000 personal & advertising injury, $1,000,000 each occurrence); Automobile Liability for owned, non-owned and hired vehicles ($1,000,000 combined single limit); Umbrella/Excess Liability ($5,000,000 each occurrence and aggregate); and, where applicable to the work, Professional Liability (Errors & Omissions, $2,000,000). Coen Construction LLC and any other parties required by the Contractor shall be named as Additional Insured on all liability policies with a waiver of subrogation, and such coverage shall be primary and non-contributing. Certificates of insurance shall state that no cancellation will be effective, nor will any policy be allowed to expire, without thirty (30) days' written notice to Coen Construction LLC, 387 Page Street, Suite 10B, Stoughton, MA 02072. No work shall start and no payments will be issued until the Contractor receives the proper certificates. Failure to provide and maintain the required insurance is a material breach of this Agreement.",
  },
  {
    heading: "Health and Safety",
    body: "Subcontractor agrees to exercise all precautions necessary to prevent accidents to itself, its workers, and all others, and shall supply at its own expense all required protective equipment. The Subcontractor shall comply at its own expense with the Federal Occupational Safety and Health Act (\"OSHA\") and all other applicable health and safety requirements, and is responsible for any penalties assessed for non-compliance by itself, its employees or agents. Subcontractor warrants that it and all of its employees have undergone proper safety and hazardous-material training as required by State or Federal law. Hazardous materials, containers and waste shall not be left on any job site and must be removed and disposed of properly at the Subcontractor's expense.",
  },
  {
    heading: "Conduct",
    body: "Subcontractor agrees that it and its employees and agents shall conduct themselves in a professional manner at all times, shall not use or be under the influence of alcoholic beverages or drugs on any job site, and shall not enter into any agreement with the Contractor's customer while the project is under construction and until the Contractor's customer has purchased the property.",
  },
  {
    heading: "Maintenance of Erosion Control",
    body: "Subcontractor agrees that it and its employees and agents shall not disturb any erosion control systems constructed on site on behalf of the Contractor. If any silt fencing or hay bales are moved to gain access to the site, those structures shall be returned to their effective status immediately. Subcontractor shall indemnify and hold harmless the Contractor and its agents and employees against all claims, fines, damages, losses and expenses (including attorney's fees) arising out of damage to erosion control structures caused by the Subcontractor, its employees or agents.",
  },
  {
    heading: "Arbitration",
    body: "Should any dispute arise respecting the provisions of this Agreement or the true meaning of the drawings or specifications, it shall be decided by binding arbitration, which shall be the sole remedy for dispute resolution. Such arbitration shall be before three disinterested arbitrators — one selected by the Subcontractor, one by the Contractor, and the third by the two so chosen. The decision of a majority of the arbitrators shall be final, binding and conclusive, and the expense of arbitration shall be borne equally by the Contractor and the Subcontractor.",
  },
  {
    heading: "Warranty",
    body: "Subcontractor shall warrant against any defects in workmanship and/or materials supplied by the Subcontractor for a period of one (1) year from the date the home or unit is first occupied by the homeowner or unit owner.",
  },
  {
    heading: "Right to Know",
    body: "All project sites are located in the Commonwealth of Massachusetts. With respect to its work area, the Subcontractor assumes responsibility for compliance with the Massachusetts Right-To-Know Law (M.G.L. c. 111F) for any toxic or hazardous substances it manufactures, processes, uses or stores, and shall coordinate implementation of the Right-To-Know Law with the Contractor and any other subcontractors whose employees may be exposed.",
  },
];

// Flattened plain-text version — sent to the server with the signature so the
// stored record and the sub's emailed copy match exactly what was displayed.
export function agreementPlainText() {
  const lines = [AGREEMENT_TITLE, `Version ${AGREEMENT_VERSION}`, "", AGREEMENT_INTRO, ""];
  AGREEMENT_SECTIONS.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.heading.toUpperCase()}`);
    lines.push(s.body);
    lines.push("");
  });
  return lines.join("\n");
}
