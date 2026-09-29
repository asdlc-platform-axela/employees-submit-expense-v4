import ballerina/os;

// Every value below is read from the environment the platform injects at
// deploy time, by the exact name workload.yaml's envBindings gives it. None
// carries a hardcoded default: an unset value reads as "" (or 0, once
// converted), and the code that consumes it falls back to a sensible default
// of its own — so this service starts with no required environment variable.

// expense-db (postgres-cnpg)
configurable string dbHost = os:getEnv("EXPENSE_DB_HOST");
configurable string dbPortRaw = os:getEnv("EXPENSE_DB_PORT");
configurable string dbUser = os:getEnv("EXPENSE_DB_USER");
configurable string dbPassword = os:getEnv("EXPENSE_DB_PASSWORD");
configurable string dbName = os:getEnv("EXPENSE_DB_DBNAME");

// email-service (SendGrid) — external
configurable string sendgridApiKey = os:getEnv("SENDGRID_API_KEY");
configurable string sendgridFromEmail = os:getEnv("SENDGRID_FROM_EMAIL");

// user-auth (thunder-app) is consumed by the gateway to mint the signed
// caller assertion this service verifies (see gateway_assertion.bal); this
// service itself never validates a token, so none of that dependency's
// envBindings are read here.

# The database port, or 5432 when unset/unparsable — Postgres' own default.
#
# + return - the configured port, or 5432
function dbPort() returns int {
    int|error parsed = int:fromString(dbPortRaw);
    if parsed is int {
        return parsed;
    }
    return 5432;
}
