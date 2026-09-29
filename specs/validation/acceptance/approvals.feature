Feature: Manager review and approval

  @story-3
  Rule: A manager sees the claims submitted by their direct reports

    Scenario: A manager views their team's claims
      Given Priya the employee, who reports to Dana the manager, has submitted a claim for "45.00" in category "Meals"
      When Dana views her team's claims
      Then Priya's claim appears among them with status "pending"

    @negative
    Scenario: A manager does not see claims from employees who are not their reports
      Given Sam the employee, who reports to Alex the manager, has submitted a claim for "80.00" in category "Travel"
      When Dana the manager, who does not manage Sam, views her team's claims
      Then Sam's claim does not appear among them

  @story-4
  Rule: Only the claim's manager may approve or reject it

    Scenario: A manager approves a pending claim
      Given Priya the employee, who reports to Dana the manager, has submitted a claim for "45.00" in category "Meals"
      When Dana approves Priya's claim
      Then Priya's claim has status "approved"

    Scenario: A manager rejects a pending claim
      Given Priya the employee, who reports to Dana the manager, has submitted a claim for "45.00" in category "Meals"
      When Dana rejects Priya's claim
      Then Priya's claim has status "rejected"

    @negative
    Scenario: A manager cannot decide a claim from someone they do not manage
      Given Sam the employee, who reports to Alex the manager, has submitted a claim for "80.00" in category "Travel"
      When Dana the manager, who does not manage Sam, tries to approve Sam's claim
      Then Sam's claim still has status "pending"
