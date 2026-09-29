# Employee Expense Claims — PRD

## Problem Statement

Employees who pay for business expenses out of pocket today rely on manual,
paper- or email-based processes to get reimbursed: claims arrive as scattered
messages or spreadsheets, managers have no single place to review and approve
them, and finance has to manually reassemble approved amounts before handing
them to payroll. This is slow, error-prone, and gives nobody — employee,
manager, or finance — visibility into where a claim stands.

## Solution

A web application where employees submit expense claims with the supporting
detail a manager needs to judge them, managers review and decide claims from
their team in one place, and finance can see every approved claim and export
them for payroll processing — replacing the ad hoc, manual handoff with a
single tracked flow from submission to payout.

## Actors

- **Employee** — submits expense claims, attaches supporting detail, and
tracks the status of their own claims.
- **Manager** — reviews expense claims submitted by the employees who report
to them, and approves or rejects each one.
- **Finance** — sees every approved expense claim across the organization and
exports them for payroll processing.

## User Stories

1. As an Employee, I want to submit an expense claim with an amount, category,
 description, and receipt attachment, so that I can get reimbursed for a
 business expense.
2. As an Employee, I want to view the status of all my submitted claims, so
 that I know whether each is pending, approved, or rejected.
3. As a Manager, I want to see the expense claims submitted by employees who
 report to me, so that I can review them.
4. As a Manager, I want to approve or reject a pending expense claim, so that
 valid expenses move toward payment and invalid ones are stopped before
 reaching finance.
5. As an Employee, I want to be notified when the status of my claim changes,
 so that I know the outcome without having to check the app.
6. As a Manager, I want to be notified when a new claim is awaiting my
 approval, so that I can act on it promptly.
7. As Finance, I want to view every approved expense claim across the
 organization, so that I can prepare them for payroll.
8. As Finance, I want to export approved expense claims to a file, so that I
 can hand them off to payroll processing.
9. As Finance, I want an exported claim to be marked as exported, so that it
 is not included in a later export by mistake.

## Product Decisions

- **Sign-in**: every user signs in via SSO through Thunder, the platform
identity provider (organization default).
- **Approval levels**: a claim requires approval from exactly one
manager — the employee's assigned manager. There is no amount-based
escalation or multi-level approval chain.
- **Manager assignment**: each employee has exactly one designated manager,
assigned as part of user setup. *assumed*
- **Claim contents**: a claim carries an amount, an expense category, a short
description, and a receipt attachment (image or PDF). *assumed*
- **Expense categories**: a fixed starter set — Travel, Meals, Lodging,
Supplies, Other. *assumed*
- **Currency**: all claims are submitted in a single, organization-wide
currency; multi-currency claims are not supported in this version.
*assumed*
- **Payroll export**: finance exports approved claims to a downloadable file
(e.g. CSV); there is no live integration with a specific payroll provider —
finance takes the file into whatever payroll system the company uses.
*assumed*
- **Notifications**: the product sends email notifications on key status
changes — an employee is notified when their claim is approved or
rejected, and a manager is notified when a new claim is awaiting their
approval. *assumed*

## Out of Scope

- Multi-level or amount-based approval escalation.
- Multi-currency claims and currency conversion.
- Direct API integration with a named payroll provider.
- Editing or withdrawing a claim once submitted — a rejected claim must be
resubmitted as a new claim rather than corrected in place.
- Reimbursement/payment execution itself — the product's responsibility ends
at exporting approved claims for payroll.

## Open Questions

*(none — outstanding decisions were resolved as assumptions above, and can be
changed at any time)*