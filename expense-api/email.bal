import expense_api.emailservice;

import ballerina/log;

final emailservice:Client emailClient = check new ({auth: {token: sendgridApiKey}});

# One string claim's domain part, or () when there is none to split on.
#
# + email - an address, e.g. "payroll@example.com"
# + return - the part after "@", or ()
function domainOf(string email) returns string? {
    int? atIndex = email.indexOf("@");
    if atIndex is () {
        return ();
    }
    return email.substring(atIndex + 1);
}

# Notifies a user by email, best-effort: this project has no directory/HR
# dependency, so no real email address exists for any user. ASSUMPTION,
# stated here rather than hidden: the recipient address is derived
# deterministically as `<username>@<domain of SENDGRID_FROM_EMAIL>` — the
# same domain the sender address itself uses.
#
# Never fails the caller's request: SendGrid credentials may be empty or
# unconfigured in this environment, and a claim submit/decide must succeed
# whether or not the notification does. A failure is logged and swallowed.
#
# + toUsername - the recipient's username
# + subject - the email subject
# + bodyText - the plain-text email body
function notifyByEmail(string toUsername, string subject, string bodyText) {
    if sendgridApiKey.trim() == "" || sendgridFromEmail.trim() == "" {
        log:printWarn("skipping email notification: email-service is not configured",
            toUsername = toUsername);
        return;
    }
    string? domain = domainOf(sendgridFromEmail);
    if domain is () {
        log:printWarn("skipping email notification: SENDGRID_FROM_EMAIL has no domain part",
            fromEmail = sendgridFromEmail);
        return;
    }
    string toEmail = toUsername + "@" + domain;
    emailservice:mail_send_body payload = {
        personalizations: [{to: [{email: toEmail}], subject}],
        'from: {email: sendgridFromEmail},
        content: [{'type: "text/plain", value: bodyText}]
    };
    error? result = emailClient->/v3/mail/send.post(payload);
    if result is error {
        log:printWarn("email-service notification failed", 'error = result, toUsername = toUsername);
    }
}
