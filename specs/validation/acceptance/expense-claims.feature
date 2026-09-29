Feature: Expense claim submission and tracking

  @story-1
  Rule: An employee submits a claim with an amount, category, description, and receipt

    Scenario: Submitting a claim for a client dinner
      Given Priya the employee is signed in
      When Priya submits a claim for "45.00" in category "Meals" with description "Client dinner" and a receipt attached
      Then the claim appears among Priya's claims with status "pending"

    @negative
    Scenario: A claim with no amount is refused
      Given Priya the employee is signed in
      When Priya tries to submit a claim with no amount, category "Meals", description "Client dinner"
      Then no new claim appears among Priya's claims

  @story-2
  Rule: An employee sees the status of every claim they have submitted

    Scenario: Checking claim statuses
      Given Priya the employee has submitted a claim for "45.00" in category "Meals"
      When Priya views her claims
      Then she sees that claim listed with status "pending"

    @negative
    Scenario: An employee cannot see another employee's claims
      Given Sam the employee has submitted a claim for "80.00" in category "Travel"
      When Priya the employee views her claims
      Then Sam's claim does not appear among them
