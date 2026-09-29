# Domain Model

The system tracks expense claims submitted by employees, decided by their
manager, and exported by finance for payroll.

```mermaid
erDiagram
    EMPLOYEE ||--o{ EXPENSE_CLAIM : submits
    EMPLOYEE ||--o| EMPLOYEE : "managed by"
    EXPENSE_CLAIM ||--|| RECEIPT : has

    EMPLOYEE {
        string id
        string name
        string email
        string managerId
    }
    EXPENSE_CLAIM {
        string id
        string employeeId
        decimal amount
        string category
        string description
        string status
        datetime submittedAt
        datetime decidedAt
        string decidedBy
        boolean exported
        datetime exportedAt
    }
    RECEIPT {
        string id
        string claimId
        string fileName
        string contentType
        string url
    }
```

- **EMPLOYEE** is every user of the system; `managerId` points at the
employee's own manager, forming the one-manager approval chain. A user with
no `managerId` has no manager (e.g. finance/top of the chain).
- **EXPENSE\_CLAIM** carries `status` (`pending`, `approved`, `rejected`) and,
once approved, `exported`/`exportedAt` so an export never includes the same
claim twice.
- **RECEIPT** is the attachment supporting one claim.

