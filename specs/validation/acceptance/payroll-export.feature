Feature: Finance export to payroll

  @story-7
  Rule: Finance sees every approved claim across the organization

    Scenario: Finance views approved claims from multiple employees
      Given Priya's claim for "45.00" in category "Meals" has been approved
      And Sam's claim for "80.00" in category "Travel" has been approved
      When Dana the finance reviewer views approved claims
      Then both claims appear among them

    @negative
    Scenario: Finance does not see claims still pending
      Given Priya's claim for "45.00" in category "Meals" is still pending
      When Dana the finance reviewer views approved claims
      Then Priya's pending claim does not appear among them

  @story-8 @story-9
  Rule: Exporting approved claims produces a file and marks them exported

    Scenario: Exporting the currently approved, unexported claims
      Given Priya's claim for "45.00" in category "Meals" has been approved and not yet exported
      When Dana the finance reviewer exports approved claims
      Then Dana receives a file containing Priya's claim
      And Priya's claim is marked exported

  @story-9
  Rule: An already-exported claim is never included in a later export

    Scenario: A second export excludes a previously exported claim
      Given Priya's claim for "45.00" in category "Meals" has already been exported
      And Sam's claim for "80.00" in category "Travel" has been approved and not yet exported
      When Dana the finance reviewer exports approved claims
      Then the file contains Sam's claim
      And the file does not contain Priya's claim
