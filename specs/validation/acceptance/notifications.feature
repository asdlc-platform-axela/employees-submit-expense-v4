Feature: Status-change notifications

  @story-5
  Rule: An employee is notified when their claim's status changes

    Scenario: Notified when a claim is approved
      Given Priya the employee has a pending claim reviewed by Dana the manager
      When Dana approves the claim
      Then Priya receives a notification that her claim was approved

    Scenario: Notified when a claim is rejected
      Given Priya the employee has a pending claim reviewed by Dana the manager
      When Dana rejects the claim
      Then Priya receives a notification that her claim was rejected

  @story-6
  Rule: A manager is notified when a new claim awaits their approval

    Scenario: Notified on a new submission from a direct report
      Given Priya the employee reports to Dana the manager
      When Priya submits a claim for "45.00" in category "Meals"
      Then Dana receives a notification that a new claim awaits her approval
