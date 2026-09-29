import ballerina/time;

// Internal domain records — distinct from the wire types `openapi_service.bal`
// generates, which carry `submittedAt` etc. as RFC3339 strings for JSON.

# A row of the `employees` table: the manager relationship this service
# maintains itself, since there is no directory/HR dependency in this project.
#
# + username - the login name, and this table's primary key
# + managerUsername - the username of this employee's manager, or () for
#                      nobody (top of the chain)
public type Employee record {|
    string username;
    string? managerUsername;
|};

# A row of the `expense_claims` table, as read back from Postgres.
#
# + id - the claim's id
# + employeeId - the submitting employee's username
# + amount - the claim amount
# + category - one of the fixed categories the contract enumerates
# + description - free-text description
# + receiptFileName - the attached receipt's file name, if any
# + receiptContentType - the attached receipt's MIME type, if any
# + receiptUrl - the attached receipt's location, if any
# + status - "pending", "approved" or "rejected"
# + submittedAt - when the claim was submitted
# + decidedAt - when a manager decided it, or () while pending
# + decidedBy - the deciding manager's username, or () while pending
# + exported - whether this claim has already been included in a payroll export
# + exportedAt - when it was exported, or () if never
public type ClaimRow record {|
    string id;
    string employeeId;
    decimal amount;
    string category;
    string description;
    string? receiptFileName;
    string? receiptContentType;
    string? receiptUrl;
    string status;
    time:Utc submittedAt;
    time:Utc? decidedAt;
    string? decidedBy;
    boolean exported;
    time:Utc? exportedAt;
|};

# A count alongside the rows it counted — what a paginated query returns.
#
# + rows - the page of rows
# + total - the total number of rows matching the filter, ignoring paging
public type CountedRows record {|
    ClaimRow[] rows;
    int total;
|};
