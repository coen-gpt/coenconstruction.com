/**
 * Canonical Coen Construction LLC customer Construction Agreement.
 *
 * Single source of truth for the digital contract the customer must read and
 * sign before an estimate can be approved. The portal / approval page render
 * these sections for the customer, and the exact same text (via
 * contractPlainText) is sent to the server and archived on the SignedContract
 * record — so what the customer saw, signed, and what the office keeps can
 * never drift apart.
 *
 * The legal wording is a template: client name/address, contract price, and
 * the payment schedule are merged in at render time from live project data.
 * Bump CONTRACT_VERSION whenever the wording changes; old signed records keep
 * the version they were signed under.
 */
export const CONTRACT_VERSION = "2026.1";

const fmtUSD = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function contractTitle(company) {
  return `${company?.company_name || "Coen Construction LLC"} — Construction Agreement`;
}

export function contractIntro({ company, clientName, clientAddress }) {
  const companyName = company?.company_name || "Coen Construction LLC";
  const companyAddress = [company?.address, company?.city, company?.state, company?.zipcode]
    .filter(Boolean).join(", ") || "387 Page Street, Suite 10B, Stoughton, Massachusetts 02072";
  const owner = clientName
    ? `${clientName}${clientAddress ? ` of ${clientAddress}` : ""} ("Owner")`
    : 'the undersigned client ("Owner")';
  return `This Agreement is made between ${owner} and ${companyName} ("Contractor"), with a principal place of business at ${companyAddress}.`;
}

/**
 * Build the numbered contract sections with project specifics merged in.
 * @param {object} ctx
 *  - company: sanitized CompanyProfile (company_name, address, city, state, zipcode, license_number)
 *  - contractPrice: number — the estimate grand total
 *  - paymentScheduleLines: string[] — Exhibit B lines, e.g. "$15,000.00 — 1st Deposit (due upon signing)"
 */
export function buildContractSections({ company, contractPrice, paymentScheduleLines } = {}) {
  const companyName = company?.company_name || "Coen Construction LLC";
  const hasSchedule = Array.isArray(paymentScheduleLines) && paymentScheduleLines.length > 0;

  return [
    {
      heading: "Services to Be Performed",
      body: "Contractor shall furnish all labor and materials to construct and complete the project shown on the contract documents contained or specified in Exhibit A (the project estimate / quote), which is attached to and made part of this Agreement.",
    },
    {
      heading: "Payment",
      body: contractPrice
        ? `Owner shall pay Contractor for all labor and materials the sum of $${fmtUSD(contractPrice)} (the "Contract Price").`
        : 'Owner shall pay Contractor for all labor and materials the total sum set forth in Exhibit A (the "Contract Price").',
    },
    {
      heading: "Terms of Payment",
      body: hasSchedule
        ? "Contractor shall be paid according to the Schedule of Payments set forth in Exhibit B, attached to and made part of this Agreement.\n\nSuspension for Non-Payment: Failure to make any required progress or benchmark payment when due shall constitute a material breach of this Agreement. Contractor reserves the right, upon written notice, to suspend all work and deliveries until such payment is received in full. Any resulting delays shall extend the Contract Time accordingly, and Contractor shall not be responsible for impacts caused by such suspension. Costs associated with stopping and remobilizing work may be charged as additional work."
        : "Contractor shall be paid according to the deposit and progress payments set forth in Exhibit A and as otherwise agreed in writing between the parties.\n\nSuspension for Non-Payment: Failure to make any required progress or benchmark payment when due shall constitute a material breach of this Agreement. Contractor reserves the right, upon written notice, to suspend all work and deliveries until such payment is received in full. Any resulting delays shall extend the Contract Time accordingly, and Contractor shall not be responsible for impacts caused by such suspension. Costs associated with stopping and remobilizing work may be charged as additional work.",
    },
    {
      heading: "Time of Completion",
      body: "Time frames provided for the scope of work are estimates. Weather and other unanticipated circumstances may result in delays.\n\nSchedules: Scheduling is done in a queue system as a \"first come, first serve\". Once contracts are signed, the project is entered into the scheduling queue and from there, the project will begin after previous projects are completed. Updates will be provided throughout.\n\nForce Majeure: Contractor shall not be liable for delays or failure to perform due to causes beyond its reasonable control, including but not limited to weather conditions, labor disputes, material shortages, acts of God, governmental actions, or other unforeseen events. Any such delays shall extend the Contract Time accordingly.",
    },
    {
      heading: "Warranty",
      body: `Contractor warrants to Owner that for a period of one (1) year from the date of Substantial Completion (the "Warranty Period"), all Work performed by Contractor (and its subcontractors) will be free from defects in workmanship and, to the extent not otherwise covered by manufacturer warranties, materials and equipment supplied by Contractor will be free from defects. This warranty does not cover damage or defects caused by: normal wear and tear; improper use, maintenance or alteration by Owner or third parties; damage from acts of God, fire, flood, or other events outside Contractor's control; pre-existing conditions not caused by Contractor; or items specifically excluded in Exhibit A.\n\nOwner must give Contractor written notice of any claimed defect within a reasonable time after discovery. Upon receipt of timely notice, Contractor will, at its option and at Contractor's expense, repair or replace the defective Work or materials within a reasonable time. If Contractor fails to commence repair or replacement within a reasonable period after notice, Owner may arrange for repair and deduct the reasonable cost from amounts due Contractor, provided Owner supplies Contractor an itemized invoice and opportunity to cure.`,
    },
    {
      heading: "Punchlist",
      body: 'Contractor will provide one (1) comprehensive punch list inspection prior to final payment, identified as "Punch List Final" in the payment schedule. All items must be documented during this inspection. Any additional punch list requests, inspections, or work identified after the initial punch list has been completed will be considered extra work and billed at an additional cost.',
    },
    {
      heading: "Site Maintenance",
      body: "Contractor agrees to be bound by the following conditions when performing the specified work:\n• Contractor will protect all flooring where work is to be performed as well as set up barriers to control dust (if applicable).\n• Contractor shall remove all debris and leave the premises in broom-clean condition.\n• Contractor shall perform the specified work during the following hours: 7am–5pm.\n• Contractor agrees that disruptively loud activities shall be performed only at the following times: 7am–5pm.\n• At the end of each day's work, Contractor's equipment shall be stored in the following location: On Site.",
    },
    {
      heading: "Subcontractors",
      body: "Contractor may at its discretion engage subcontractors to perform services under this Agreement, but Contractor shall remain responsible for proper completion of this Agreement.",
    },
    {
      heading: "Independent Contractor Status",
      body: "Contractor is an independent contractor, not Owner's employee. Contractor's employees or subcontractors are not Owner's employees. Contractor and Owner agree to the following rights consistent with an independent contractor relationship:\n• Contractor has the right to perform services for others during the term of this Agreement.\n• Contractor has the sole right to control and direct the means, manner, and method by which the services required by this Agreement will be performed.\n• Contractor or Contractor's employees or subcontractors shall perform the services required by this Agreement; Owner shall not hire, supervise, or pay any assistants to help.\n• Owner shall not require Contractor or Contractor's employees or subcontractors to devote full time to performing the services required by this Agreement.\n• Neither Contractor nor Contractor's employees or subcontractors are eligible to participate in any employee pension, health, vacation pay, sick pay, or other fringe benefit plan of Owner.",
    },
    {
      heading: "Permits, Inspections and Code Compliance",
      body: "Contractor Responsibility: Unless otherwise agreed in Exhibit A, Contractor shall obtain and pay for all permits, inspections, licenses and filing fees required for performance of the Work and shall schedule and coordinate all required inspections.\n\nCompliance and Corrections: Contractor shall perform the Work in compliance with all applicable laws, codes and regulations and shall correct, at Contractor's expense, any code violations caused by Contractor's work.\n\nOwner Cooperation: Owner shall provide reasonable access, utilities and any information requested by Contractor. Delays caused by Owner's failure to cooperate shall entitle Contractor to time and price adjustments.",
    },
    {
      heading: "Insurance",
      body: "Contractor shall carry adequate business liability insurance for damage to Owner's property and worker's compensation insurance for injuries to its employees, subcontractors and others incurring loss or injury of Contractor or its employees or subcontractors.",
    },
    {
      heading: "Indemnification and Liability",
      body: "Mutual Third-Party Indemnity: Each party (Indemnitor) shall indemnify, defend and hold the other (Indemnitee) harmless from and against third-party claims, damages, losses and reasonable attorney's fees to the extent caused by the Indemnitor's negligence or willful misconduct in connection with this Agreement. Indemnitor shall promptly assume and control the defense of any such claim, provided Indemnitee may participate at its own expense; no settlement that admits fault or imposes liability on Indemnitee may be entered without Indemnitee's consent (not to be unreasonably withheld).\n\nOwner Indemnity for Owner Risks: Owner shall indemnify, defend and hold Contractor harmless from claims, damages, losses and reasonable attorney's fees arising out of Owner's negligence, acts or omissions, site conditions provided by Owner, or Owner-directed changes.\n\nContractor Liability Cap and Exclusions: Contractor shall not be liable for consequential, incidental, special or punitive damages (including lost profits or loss of use). Contractor's aggregate liability for all claims arising out of or related to this Agreement shall be limited to the total Contract Price, except for liability resulting from Contractor's gross negligence, willful misconduct, fraud, or any liability that cannot be limited by applicable law (including uncompromisable statutory obligations and bodily injury/death where required).\n\nSubcontractor Flow-Down: Contractor shall require subcontractors to carry insurance and to indemnify Contractor to the same extent subcontractor is responsible for the claim.",
    },
    {
      heading: "Terminating the Agreement",
      body: "Either Owner or Contractor may terminate this Agreement at any time by giving three days' written notice of termination. Contractor shall be entitled to full payment for services performed prior to the date of termination.",
    },
    {
      heading: "Exclusive Agreement",
      body: "This writing (including any exhibits) is the entire Agreement between Contractor and Owner. The exhibits attached to this Agreement are Exhibit A (the project estimate / quote)" + (hasSchedule ? " and Exhibit B (the Schedule of Payments)." : "."),
    },
    {
      heading: "Modifying the Agreement",
      body: "Owner and Contractor recognize that: Contractor's original cost and time estimates may be too low due to unforeseen events or to factors unknown to Contractor when this Agreement was made; Owner may desire a mid-project change in Contractor's services that would add time and cost to the project; or other provisions of this Agreement may be difficult to carry out due to unforeseen circumstances. If any intended changes or any other events beyond the parties' control require adjustments to this Agreement, the parties shall make a good faith effort to agree on all necessary particulars. Such agreements shall be put in writing, signed by the parties, and added to this Agreement.\n\nChange Orders: Any changes to the scope of work must be authorized in writing by both parties prior to execution. All change orders may result in adjustments to the Contract Price and Contract Time. Work performed without an approved written change order shall be at the Contractor's discretion and may not be warranted or included in the Contract.",
    },
    {
      heading: "Resolving Disputes",
      body: "If a dispute arises under this Agreement, the parties agree to first try to resolve the dispute with the help of a mutually agreed-upon mediator in Boston, Massachusetts. Any costs and fees other than attorney fees associated with the mediation shall be shared equally by the parties. If it proves impossible to arrive at a mutually satisfactory solution through mediation, the parties agree to submit the dispute to a mutually agreed-upon arbitrator in Boston, Massachusetts. Judgment upon the award rendered by the arbitrator may be entered in any court having jurisdiction to do so. Costs of arbitration, including attorney fees, will be allocated by the arbitrator.",
    },
    {
      heading: "Notices",
      body: "All notices and other communications in connection with this Agreement shall be in writing and shall be considered given as follows: when sent by electronic mail, such notice is effective upon receipt, provided that a duplicate copy of the notice is promptly given by first class mail, or the recipient delivers a written confirmation of receipt.",
    },
    {
      heading: "No Partnership",
      body: "This Agreement does not create a partnership relationship. Neither party has authority to enter into contracts on the other's behalf.",
    },
    {
      heading: "Applicable Law",
      body: `This Agreement will be governed by the laws of the Commonwealth of Massachusetts.${company?.license_number ? ` ${companyName} license: ${company.license_number}.` : ""}`,
    },
  ];
}

/**
 * Flattened plain-text version — sent to the server with the signature so the
 * archived SignedContract record matches exactly what was displayed.
 */
export function contractPlainText(ctx = {}) {
  const lines = [
    contractTitle(ctx.company),
    `Version ${CONTRACT_VERSION}`,
    "",
    contractIntro(ctx),
    "",
  ];
  buildContractSections(ctx).forEach((s, i) => {
    lines.push(`${i + 1}. ${s.heading.toUpperCase()}`);
    lines.push(s.body);
    lines.push("");
  });
  if (Array.isArray(ctx.paymentScheduleLines) && ctx.paymentScheduleLines.length > 0) {
    lines.push("EXHIBIT B — SCHEDULE OF PAYMENTS");
    ctx.paymentScheduleLines.forEach(l => lines.push(l));
    lines.push("");
  }
  return lines.join("\n");
}

/** Human-readable Exhibit B lines from sanitized payment-schedule milestones. */
export function scheduleLinesFromMilestones(milestones) {
  return (milestones || [])
    .filter(m => m && (m.amount || m.amount === 0) && m.label)
    .map(m => `$${fmtUSD(m.amount)} — ${m.label}${m.trigger ? ` (${m.trigger})` : ""}`);
}
