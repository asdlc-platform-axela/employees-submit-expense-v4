screen MyClaims "An employee's own submitted claims and their status"
  navbar "Expense Claims"
  sidebar "My Claims -> MyClaims | Submit Claim -> SubmitClaim"
  row
    heading "My Claims"
    right
    button "Submit Claim" primary -> SubmitClaim
  table "Date | Category | Amount | Status"
    row "Sep 12 | Travel | $240.00 | Pending"
    row "Sep 3 | Meals | $38.50 | Approved"
    row "Aug 28 | Supplies | $19.99 | Rejected"

screen SubmitClaim "An employee submits a new expense claim"
  navbar "Expense Claims"
  sidebar "My Claims -> MyClaims | Submit Claim -> SubmitClaim"
  heading "Submit Claim"
  input "Amount"
  select "Category"
  textarea "Description"
  input "Receipt file"
  row
    right
    button "Cancel" -> MyClaims
    button "Submit" primary -> MyClaims

screen TeamClaims "A manager reviews claims submitted by their direct reports"
  navbar "Expense Claims"
  sidebar "Team Claims -> TeamClaims"
  heading "Team Claims"
  table "Employee | Date | Category | Amount | Status" -> ClaimDetail
    row "Priya | Sep 12 | Travel | $240.00 | Pending"
    row "Sam | Sep 10 | Meals | $52.00 | Pending"
    row "Priya | Sep 3 | Meals | $38.50 | Approved"

screen ClaimDetail "A manager decides one pending claim"
  navbar "Expense Claims"
  sidebar "Team Claims -> TeamClaims"
  heading "Claim from Priya"
  text "Travel — $240.00"
  text "Client site visit, round-trip mileage and parking."
  image "Receipt"
  row
    right
    button "Reject" danger -> TeamClaims
    button "Approve" primary -> TeamClaims

screen ApprovedClaims "Finance reviews every approved claim and exports the unexported ones"
  navbar "Expense Claims"
  sidebar "Approved Claims -> ApprovedClaims"
  row
    heading "Approved Claims"
    right
    button "Export to Payroll" primary -> ExportConfirmation
  table "Employee | Date | Category | Amount | Exported"
    row "Priya | Sep 3 | Meals | $38.50 | No"
    row "Sam | Aug 20 | Travel | $180.00 | No"
    row "Priya | Aug 1 | Supplies | $25.00 | Yes"

screen ExportConfirmation "Finance confirms the export just produced"
  navbar "Expense Claims"
  sidebar "Approved Claims -> ApprovedClaims"
  heading "Export Complete"
  text "2 claims exported to payroll_export_2026-09-29.csv"
  row
    right
    button "Back to Approved Claims" primary -> ApprovedClaims

flow "Submit and track claims"
  role "Employee"
  description "An employee submits a claim and follows its status"
  MyClaims
  SubmitClaim

flow "Review team claims"
  role "Manager"
  description "A manager reviews and decides claims from their reports"
  TeamClaims
  ClaimDetail

flow "Export to payroll"
  role "FinanceReviewer"
  description "Finance exports approved, unexported claims"
  ApprovedClaims
  ExportConfirmation
