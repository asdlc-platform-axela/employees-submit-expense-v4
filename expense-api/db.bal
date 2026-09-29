import ballerina/log;
import ballerina/sql;
import ballerina/time;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// The client is constructed lazily, on first actual use, and memoized here —
// rather than eagerly at module load (code-rules.md's usual "final client at
// module level" pattern). A real deployment's database is reachable, so the
// first request pays this cost once, same as an eager connect would. The
// difference is what happens with NO database at all: `bal test` runs in
// this sandbox with no `expense-db` wiring, and an eager `check new(...)`
// there blocks for the connector's own connection timeout and then fails
// the whole module — before any test, including the gateway-assertion ones
// that touch no database function at all, gets to run. Lazily, those tests
// never call `db()` and never pay that cost.
postgresql:Client? dbClientInstance = ();

# The Postgres client, constructing (and idempotently initializing the schema
# on) it on first call, memoized after that.
#
# + return - the client, or an error when the database is unreachable
function db() returns postgresql:Client|error {
    postgresql:Client? existing = dbClientInstance;
    if existing is postgresql:Client {
        return existing;
    }
    postgresql:Client newClient = check new (
        host = dbHost,
        username = dbUser,
        password = dbPassword,
        database = dbName,
        port = dbPort()
    );
    dbClientInstance = newClient;
    error? initResult = initDb(newClient);
    if initResult is error {
        log:printError("database schema init/seed failed on first use; continuing anyway",
            'error = initResult);
    }
    return newClient;
}

function initDb(postgresql:Client dbClient) returns error? {
    check createSchema(dbClient);
    check seedKnownManagerRelationships(dbClient);
}

function createSchema(postgresql:Client dbClient) returns error? {
    sql:ExecutionResult _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS employees (
            username TEXT PRIMARY KEY,
            manager_username TEXT
        )`);
    sql:ExecutionResult _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS expense_claims (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            receipt_file_name TEXT,
            receipt_content_type TEXT,
            receipt_url TEXT,
            status TEXT NOT NULL,
            submitted_at TIMESTAMPTZ NOT NULL,
            decided_at TIMESTAMPTZ,
            decided_by TEXT,
            exported BOOLEAN NOT NULL DEFAULT FALSE,
            exported_at TIMESTAMPTZ
        )`);
}

// This project has no directory/HR dependency and openapi.yaml has no
// endpoint to assign a manager, so the only way to establish "who reports to
// whom" is to seed the five users this project's Thunder app provisions
// (specs/design/security.json), once, idempotently — ON CONFLICT DO NOTHING
// never overwrites a row a real request has already created.
function seedKnownManagerRelationships(postgresql:Client dbClient) returns error? {
    check upsertEmployeeIfAbsentWith(dbClient, "test-manager", ());
    check upsertEmployeeIfAbsentWith(dbClient, "test-manager2", ());
    check upsertEmployeeIfAbsentWith(dbClient, "test-financereviewer", ());
    check upsertEmployeeIfAbsentWith(dbClient, "test-employee", "test-manager");
    check upsertEmployeeIfAbsentWith(dbClient, "test-employee2", "test-manager2");
}

// Upserts a caller's own row on first sight, or seeds a known relationship at
// startup. ON CONFLICT DO NOTHING means an existing row's managerUsername is
// never overwritten by this call, whichever caller it is for.
function upsertEmployeeIfAbsentWith(postgresql:Client dbClient, string username, string? managerUsername)
        returns error? {
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO employees (username, manager_username)
        VALUES (${username}, ${managerUsername})
        ON CONFLICT (username) DO NOTHING`);
}

function upsertEmployeeIfAbsent(string username, string? managerUsername) returns error? {
    postgresql:Client dbClient = check db();
    check upsertEmployeeIfAbsentWith(dbClient, username, managerUsername);
}

function ensureEmployeeRow(string username) returns error? {
    check upsertEmployeeIfAbsent(username, ());
}

# The username's manager, or () when they have none (or no row exists).
#
# + username - the employee to look up
# + return - the manager's username, or ()
function managerOf(string username) returns string?|error {
    postgresql:Client dbClient = check db();
    string? managerUsername = check dbClient->queryRow(
        `SELECT manager_username FROM employees WHERE username = ${username}`);
    return managerUsername;
}

# Every username whose `manager_username` is this caller's — "my direct reports".
#
# + managerUsername - the manager to look up
# + return - the usernames of every direct report
function directReportsOf(string managerUsername) returns string[]|error {
    postgresql:Client dbClient = check db();
    stream<record {| string username; |}, sql:Error?> resultStream =
        dbClient->query(`SELECT username FROM employees WHERE manager_username = ${managerUsername}`);
    string[] usernames = [];
    check from record {| string username; |} row in resultStream
        do {
            usernames.push(row.username);
        };
    return usernames;
}

function selectClaimsQuery() returns sql:ParameterizedQuery {
    return `SELECT id, employee_id AS "employeeId", amount, category, description,
        receipt_file_name AS "receiptFileName", receipt_content_type AS "receiptContentType",
        receipt_url AS "receiptUrl", status, submitted_at AS "submittedAt",
        decided_at AS "decidedAt", decided_by AS "decidedBy", exported,
        exported_at AS "exportedAt"
        FROM expense_claims `;
}

# `(v1, v2, …)` built from bound parameters — never string-concatenated values.
#
# + values - the values to bind, in order
# + return - the parenthesized, comma-joined clause
function inClause(string[] values) returns sql:ParameterizedQuery {
    sql:ParameterizedQuery clause = `(`;
    foreach int i in 0 ..< values.length() {
        string value = values[i];
        clause = i == 0 ? sql:queryConcat(clause, `${value}`) : sql:queryConcat(clause, `, ${value}`);
    }
    return sql:queryConcat(clause, `)`);
}

function pageOfClaims(sql:ParameterizedQuery whereClause, int 'limit, int offset) returns CountedRows|error {
    postgresql:Client dbClient = check db();
    sql:ParameterizedQuery countQuery = sql:queryConcat(`SELECT COUNT(*) FROM expense_claims `, whereClause);
    int total = check dbClient->queryRow(countQuery);

    sql:ParameterizedQuery dataQuery = sql:queryConcat(selectClaimsQuery(), whereClause,
        ` ORDER BY submitted_at DESC LIMIT ${'limit} OFFSET ${offset}`);
    stream<ClaimRow, sql:Error?> resultStream = dbClient->query(dataQuery);
    ClaimRow[] rows = [];
    check from ClaimRow row in resultStream
        do {
            rows.push(row);
        };
    return {rows, total};
}

function myClaimsPage(string employeeUsername, string? status, int 'limit, int offset) returns CountedRows|error {
    sql:ParameterizedQuery whereClause = `WHERE employee_id = ${employeeUsername}`;
    if status is string {
        whereClause = sql:queryConcat(whereClause, ` AND status = ${status}`);
    }
    return pageOfClaims(whereClause, 'limit, offset);
}

function teamClaimsPage(string[] employeeUsernames, string? status, int 'limit, int offset)
        returns CountedRows|error {
    if employeeUsernames.length() == 0 {
        return {rows: [], total: 0};
    }
    sql:ParameterizedQuery whereClause = sql:queryConcat(`WHERE employee_id IN `, inClause(employeeUsernames));
    if status is string {
        whereClause = sql:queryConcat(whereClause, ` AND status = ${status}`);
    }
    return pageOfClaims(whereClause, 'limit, offset);
}

function approvedClaimsPage(boolean? exported, int 'limit, int offset) returns CountedRows|error {
    sql:ParameterizedQuery whereClause = `WHERE status = 'approved'`;
    if exported is boolean {
        whereClause = sql:queryConcat(whereClause, ` AND exported = ${exported}`);
    }
    return pageOfClaims(whereClause, 'limit, offset);
}

# A single claim, by id and nothing else — used where the caller's reach is
# every row (an approve/reject decision resolves the employee filter itself,
# from the manager relationship, not from this query).
#
# + claimId - the claim to look up
# + return - the claim, or () when no row has that id
function getClaimById(string claimId) returns ClaimRow?|error {
    postgresql:Client dbClient = check db();
    ClaimRow|sql:Error result = dbClient->queryRow(
        sql:queryConcat(selectClaimsQuery(), `WHERE id = ${claimId}`), ClaimRow);
    if result is sql:NoRowsError {
        return ();
    }
    if result is sql:Error {
        return result;
    }
    return result;
}

# A single claim, gated on the caller's own username — `/me/claims/{claimId}`.
# A row that exists but is not the caller's is not in this collection.
#
# + claimId - the claim to look up
# + employeeUsername - the caller's own username
# + return - the claim, or () when no row matches both
function getClaimByIdForEmployee(string claimId, string employeeUsername) returns ClaimRow?|error {
    postgresql:Client dbClient = check db();
    ClaimRow|sql:Error result = dbClient->queryRow(
        sql:queryConcat(selectClaimsQuery(), `WHERE id = ${claimId} AND employee_id = ${employeeUsername}`),
        ClaimRow);
    if result is sql:NoRowsError {
        return ();
    }
    if result is sql:Error {
        return result;
    }
    return result;
}

function insertClaim(ClaimRow row) returns error? {
    postgresql:Client dbClient = check db();
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO expense_claims
            (id, employee_id, amount, category, description, receipt_file_name,
             receipt_content_type, receipt_url, status, submitted_at, decided_at,
             decided_by, exported, exported_at)
        VALUES
            (${row.id}, ${row.employeeId}, ${row.amount}, ${row.category}, ${row.description},
             ${row.receiptFileName}, ${row.receiptContentType}, ${row.receiptUrl}, ${row.status},
             ${row.submittedAt}, ${row.decidedAt}, ${row.decidedBy}, ${row.exported}, ${row.exportedAt})`);
}

function decideClaim(string claimId, string status, time:Utc decidedAt, string decidedBy) returns error? {
    postgresql:Client dbClient = check db();
    sql:ExecutionResult _ = check dbClient->execute(`
        UPDATE expense_claims
        SET status = ${status}, decided_at = ${decidedAt}, decided_by = ${decidedBy}
        WHERE id = ${claimId}`);
}

# Selects every `approved`, unexported claim and marks it exported, in the one
# statement Postgres runs atomically — so two concurrent exports can never
# both select the same row, and a later export never repeats one this call
# already claimed.
#
# + exportedAt - the timestamp to stamp every exported row with
# + return - every claim this call just marked exported
function exportApprovedUnexported(time:Utc exportedAt) returns ClaimRow[]|error {
    postgresql:Client dbClient = check db();
    stream<ClaimRow, sql:Error?> resultStream = dbClient->query(`
        UPDATE expense_claims
        SET exported = true, exported_at = ${exportedAt}
        WHERE status = 'approved' AND exported = false
        RETURNING id, employee_id AS "employeeId", amount, category, description,
            receipt_file_name AS "receiptFileName", receipt_content_type AS "receiptContentType",
            receipt_url AS "receiptUrl", status, submitted_at AS "submittedAt",
            decided_at AS "decidedAt", decided_by AS "decidedBy", exported,
            exported_at AS "exportedAt"`);
    ClaimRow[] rows = [];
    check from ClaimRow row in resultStream
        do {
            rows.push(row);
        };
    return rows;
}
