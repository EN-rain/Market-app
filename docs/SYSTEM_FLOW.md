# PocketTrade System Flow

This document explains how the PocketTrade mobile app, admin dashboard, backend API, database, file storage, email service, and real-time messaging work together.

It is intended for developers, testers, project reviewers, and anyone who needs to understand the system without reading the entire codebase first.

---

## 1. System Overview

PocketTrade is a used-mobile-phone marketplace with three main parts:

1. **Flutter mobile app** — used by buyers and sellers.
2. **React admin dashboard** — used by administrators to review listings, reports, and users.
3. **NestJS backend API** — handles authentication, listings, messaging, moderation, uploads, and database access.

```mermaid
flowchart LR
    U[Buyer or Seller] --> M[Flutter Mobile App]
    A[Administrator] --> W[React Admin Dashboard]

    M -->|HTTPS REST API| B[NestJS Backend]
    W -->|HTTPS REST API| B
    M <-->|Socket.IO| B

    B --> D[(PostgreSQL Database)]
    B --> E[Mailjet Email API]
    B --> C[Cloudinary or Local Upload Storage]
    B --> F[Firebase Cloud Messaging]
```

---

## 2. Main Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Mobile frontend | Flutter | Buyer and seller Android application |
| Admin frontend | React + Vite | Browser-based administration panel |
| Backend | NestJS | REST API, authentication, moderation, and business logic |
| Database | PostgreSQL + Prisma | Stores users, listings, messages, reports, and tokens |
| Real-time chat | Socket.IO | Sends and receives messages instantly |
| Email | Mailjet | Sends email OTP codes |
| Images | Cloudinary or local storage | Stores listing and profile images |
| Push notifications | Firebase Cloud Messaging | Sends mobile notifications |
| Deployment | Render | Hosts the backend and database |

---

## 3. Request Flow

Every normal frontend request follows this general path:

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Mobile App or Admin Dashboard
    participant API as NestJS Backend
    participant DB as PostgreSQL

    User->>Frontend: Performs an action
    Frontend->>API: Sends HTTP request
    API->>API: Validates request and authentication
    API->>DB: Reads or updates records
    DB-->>API: Returns result
    API-->>Frontend: Returns JSON response
    Frontend-->>User: Updates the screen
```

Examples of actions:

- Requesting an OTP
- Logging in
- Searching for phones
- Creating a listing
- Approving a listing
- Sending a report
- Loading conversations

---

## 4. Authentication Flow

PocketTrade uses email-based authentication. A phone number is not required.

The implemented backend supports both:

- Email/password registration and login.
- Email OTP verification through `POST /auth/request-otp` and `POST /auth/verify-otp`.

The current Flutter app uses password login for returning users, sends an OTP after registration, and uses OTP codes for password reset. Direct email-only OTP login is still available at the API level.

```mermaid
sequenceDiagram
    participant U as User
    participant M as Mobile App
    participant B as Backend
    participant Mail as Mailjet
    participant DB as PostgreSQL

    U->>M: Enters email and password
    M->>B: Register account
    B->>DB: Create or update password-backed user
    B->>B: Generate temporary OTP
    B->>DB: Save hashed OTP, expiry, and attempt limits
    B->>Mail: Send OTP email
    Mail-->>U: Deliver OTP

    U->>M: Enters OTP
    M->>B: Verify email and OTP
    B->>DB: Validate OTP and expiry
    B->>DB: Load or create user account
    B-->>M: Access token + refresh token + user data
    M->>M: Store tokens in secure storage
    M-->>U: Open home screen
```

### Authentication rules

- OTP codes expire after a limited time.
- OTP resend requests have a cooldown.
- Passwords are stored as bcrypt hashes.
- Verification attempts are limited.
- Access tokens are required for protected endpoints.
- Refresh tokens are rotated when refreshed.
- Suspended or deleted users are rejected even if an older token exists.
- API secrets remain only in the backend and must never be included in Flutter or React code.

---

## 5. Mobile App Navigation

```mermaid
flowchart TD
    Start[App Starts] --> Token{Valid access token?}
    Token -- No --> Login[Email/password or OTP auth]
    Token -- Yes --> Home[Home]

    Login --> Home

    Home --> Search[Search and Filters]
    Home --> Details[Listing Details]
    Home --> Sell[Create Listing]
    Home --> Messages[Messages]
    Home --> Profile[Profile]
    Home --> Favorites[Favorites]

    Search --> Details
    Details --> Chat[Chat with Seller]
    Messages --> Chat
    Sell --> Pending[Listing Submitted as Pending]
```

The bottom navigation contains:

- Home
- Search
- Sell
- Messages
- Profile

---

## 6. Listing Creation and Approval Flow

A seller cannot publish a listing directly to the public marketplace. Every new or edited listing must pass administrator review.

```mermaid
sequenceDiagram
    participant S as Seller
    participant M as Mobile App
    participant B as Backend
    participant DB as PostgreSQL
    participant A as Admin Dashboard

    S->>M: Enter phone details and upload images
    M->>B: Submit listing
    B->>B: Validate fields, price, ownership, and images
    B->>DB: Save listing with status = pending
    B-->>M: Listing submitted for approval

    A->>B: Load pending listings
    B->>DB: Read pending listings
    DB-->>B: Return listings
    B-->>A: Display moderation queue

    A->>B: Approve or reject listing

    alt Approved
        B->>DB: Set status = active
        B-->>A: Approval successful
        B-->>M: Listing becomes publicly available
    else Rejected
        B->>DB: Set status = rejected
        B-->>A: Rejection successful
        B-->>M: Seller can review and edit listing
    end
```

### Listing statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for administrator review |
| `active` | Approved and visible publicly |
| `rejected` | Rejected by an administrator |
| `sold` | Seller marked the phone as sold |
| `removed` | Seller or administrator removed the listing |
| `expired` | Listing is no longer current and can be republished |

### Public visibility rule

Only approved public statuses such as `active` and `sold` may be returned by public listing endpoints. Pending or rejected listings must not appear in public search or public listing details.

---

## 7. Listing Search Flow

```mermaid
flowchart LR
    U[Buyer] --> S[Search Screen]
    S --> Q[Enter keyword or filters]
    Q --> API[Backend Search Endpoint]
    API --> V[Validate query parameters]
    V --> DB[(PostgreSQL)]
    DB --> R[Return active or sold listings]
    R --> API
    API --> S
    S --> U
```

Available filters may include:

- Brand
- Model
- Minimum and maximum price
- Location
- Condition
- Search keyword

The backend must apply visibility rules. The mobile app must not be trusted to hide restricted records by itself.

---

## 8. Listing Details Flow

```mermaid
sequenceDiagram
    participant B as Buyer
    participant M as Mobile App
    participant API as Backend
    participant DB as PostgreSQL

    B->>M: Opens a listing
    M->>API: GET listing by ID
    API->>DB: Find listing and seller
    DB-->>API: Listing, images, seller details
    API-->>M: Public listing data
    M-->>B: Show price, details, images, and seller

    B->>M: Add to favorites or contact seller
    M->>API: Send authenticated request
    API->>DB: Save favorite or create conversation
    API-->>M: Return result
```

Private information such as personal phone numbers and private email addresses should not be exposed on listing pages.

---

## 9. Messaging Flow

PocketTrade uses both REST endpoints and Socket.IO.

- REST is used to load conversations and message history.
- Socket.IO is used for real-time message delivery.

```mermaid
sequenceDiagram
    participant Buyer
    participant BuyerApp
    participant API as Backend + Socket.IO
    participant DB as PostgreSQL
    participant SellerApp
    participant Seller

    Buyer->>BuyerApp: Contact seller
    BuyerApp->>API: Create or load conversation
    API->>DB: Verify buyer, seller, and listing
    DB-->>API: Conversation
    API-->>BuyerApp: Conversation ID

    BuyerApp->>API: Join authorized conversation room
    SellerApp->>API: Join authorized conversation room

    Buyer->>BuyerApp: Send message
    BuyerApp->>API: Socket message event
    API->>API: Confirm sender belongs to conversation
    API->>DB: Save message
    API-->>BuyerApp: Emit message
    API-->>SellerApp: Emit message
    SellerApp-->>Seller: Display message
```

### Messaging security

- Users may only join conversations they belong to.
- The backend verifies membership before joining a Socket.IO room.
- Messages are stored in the database.
- Email addresses and phone numbers do not need to be exposed.
- Blocking or suspension should prevent continued access where applicable.

---

## 10. Favorites Flow

```mermaid
flowchart TD
    U[User opens a listing] --> T{Already favorited?}
    T -- No --> Add[Add favorite]
    Add --> API1[Backend saves user-listing relation]
    API1 --> Done1[Heart becomes active]

    T -- Yes --> Remove[Remove favorite]
    Remove --> API2[Backend deletes relation]
    API2 --> Done2[Heart becomes inactive]
```

Favorites are linked to the authenticated user and listing ID.

---

## 11. Reporting Flow

Users can report suspicious or inappropriate listings.

```mermaid
sequenceDiagram
    participant U as User
    participant M as Mobile App
    participant B as Backend
    participant DB as PostgreSQL
    participant A as Admin Dashboard

    U->>M: Submit report reason
    M->>B: Create report
    B->>DB: Save report with open status
    B-->>M: Report submitted

    A->>B: Load reports
    B->>DB: Read reports
    DB-->>B: Report records
    B-->>A: Display moderation queue

    A->>B: Resolve report or take action
    B->>DB: Update report, listing, or user
```

Administrators may:

- Resolve or dismiss reports
- Remove or reject listings
- Suspend abusive users
- Review related listing and account information

---

## 12. Admin Dashboard Flow

```mermaid
flowchart TD
    Login[Admin Login] --> Auth[Backend verifies credentials]
    Auth --> Dash[Admin Dashboard]

    Dash --> Pending[Pending Listings]
    Dash --> Users[User Management]
    Dash --> Reports[Reports]
    Dash --> Listings[All Listings]

    Pending --> Approve[Approve Listing]
    Pending --> Reject[Reject Listing]

    Users --> Suspend[Suspend User]
    Users --> Restore[Restore User]

    Reports --> Resolve[Resolve Report]
    Reports --> Moderate[Moderate Listing or User]
```

Admin authorization is enforced by backend role guards. Hiding an admin button in the React frontend is not sufficient protection.

---

## 13. Image Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as Mobile App
    participant API as Backend
    participant Store as Cloudinary or Local Storage
    participant DB as PostgreSQL

    U->>App: Select listing photos
    App->>API: Multipart image upload
    API->>API: Validate file size and type
    API->>Store: Upload image
    Store-->>API: Return public image URL
    API->>DB: Save URL with listing
    API-->>App: Return uploaded image information
```

Image validation should include:

- Accepted MIME types
- Maximum file size
- Maximum number of images
- Authentication and listing ownership
- Safe file naming

For production, Cloudinary or another dedicated object-storage service is safer than relying on temporary local filesystem storage.

---

## 14. Push Notification Flow

```mermaid
flowchart LR
    Event[New message or important event] --> B[Backend]
    B --> T[Find recipient device token]
    T --> F[Firebase Cloud Messaging]
    F --> P[Recipient Android Device]
    P --> N[Notification shown]
```

Push notifications are separate from Socket.IO:

- Socket.IO works while the app is connected.
- Firebase notifications can notify the user while the app is in the background or closed.

---

## 15. Database Relationships

The exact Prisma schema is the source of truth, but the system can be understood through these main relationships:

```mermaid
erDiagram
    USER ||--o{ LISTING : creates
    USER ||--o{ FAVORITE : saves
    LISTING ||--o{ FAVORITE : receives
    USER ||--o{ CONVERSATION : participates
    LISTING ||--o{ CONVERSATION : concerns
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ MESSAGE : sends
    USER ||--o{ REPORT : submits
    LISTING ||--o{ REPORT : receives
    LISTING ||--o{ LISTING_IMAGE : has
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ DEVICE_TOKEN : registers
```

### Main stored entities

- User
- Listing
- Listing image
- Favorite
- Conversation
- Message
- Report
- OTP record
- Refresh or revoked token record
- Device notification token

---

## 16. Backend Module Responsibilities

```mermaid
flowchart TD
    App[AppModule] --> Auth[Auth Module]
    App --> Users[Users Module]
    App --> Listings[Listings Module]
    App --> Messages[Conversations and Messages]
    App --> Reports[Reports Module]
    App --> Uploads[Uploads Module]
    App --> Notifications[Notifications Module]
    App --> Prisma[Prisma Database Service]
```

| Module | Responsibility |
|---|---|
| Auth | Registration, password login, OTP requests, OTP verification, password reset, JWT, refresh tokens |
| Users | Profiles, account state, administration |
| Listings | Create, edit, search, moderation, ownership |
| Conversations | Create and load buyer-seller conversations |
| Messages | Store and deliver chat messages |
| Reports | User reports and admin resolution |
| Uploads | Image validation and storage |
| Notifications | Firebase device tokens and push messages |
| Prisma | Database access shared by backend services |

---

## 17. Backend Security Layers

```mermaid
flowchart LR
    R[Incoming Request] --> V[DTO Validation]
    V --> T[Rate Limiting]
    T --> J[JWT Authentication]
    J --> U[Reload Current User]
    U --> S{Account active?}
    S -- No --> Reject[Reject Request]
    S -- Yes --> Role[Role and Ownership Checks]
    Role --> Logic[Business Logic]
    Logic --> DB[(Database)]
```

Important controls:

- Request DTO validation
- Rate limiting for OTP and authentication
- JWT verification
- Current account status check
- Role checks for administrator endpoints
- Ownership checks for seller actions
- Conversation membership checks
- Listing visibility checks
- Secure secret management through environment variables
- Restricted CORS configuration in production

---

## 18. Environment Variables

The backend receives configuration through environment variables. Exact names may vary by implementation, but the categories include:

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
CORS_ORIGINS=

MAILJET_API_KEY=
MAILJET_API_SECRET=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=PocketTrade

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Rules:

- Never commit real secrets to GitHub.
- Never place backend API secrets in Flutter or React source code.
- Use Render environment variables for production.
- Use a local `.env` file for development and keep it ignored by Git.

---

## 19. Deployment Flow

```mermaid
flowchart LR
    Dev[Developer pushes to GitHub] --> Git[GitHub main branch]
    Git --> Render[Render Web Service]
    Render --> Docker[Build root Dockerfile]
    Docker --> Prisma[Run Prisma migrations]
    Prisma --> API[Start NestJS backend]
    API --> Health[Service available on onrender.com]
```

Current backend deployment expects:

- Repository root as Docker build context
- Root `Dockerfile`
- PostgreSQL `DATABASE_URL`
- Required authentication and email environment variables
- Render-provided `PORT`

The backend reads `PORT` from the environment and falls back to port `3000` locally.

---

## 20. Android Development Connection

When running the backend on the same Windows computer as the Android emulator:

```text
Android emulator API URL: http://10.0.2.2:3000
Windows browser API URL:  http://localhost:3000
```

`localhost` inside the Android emulator points to the emulator itself. `10.0.2.2` is the emulator address for the host computer.

For a physical phone on the same Wi-Fi network, use the computer's local IPv4 address:

```text
http://YOUR-PC-IP:3000
```

---

## 21. Typical Buyer Journey

```mermaid
flowchart TD
    A[Open app] --> B[Log in with email/password or OTP]
    B --> C[Browse or search phones]
    C --> D[Open listing]
    D --> E{Interested?}
    E -- No --> C
    E -- Yes --> F[Add favorite or message seller]
    F --> G[Discuss through in-app chat]
    G --> H[Complete transaction outside the app]
```

---

## 22. Typical Seller Journey

```mermaid
flowchart TD
    A[Log in] --> B[Tap Sell]
    B --> C[Enter phone details]
    C --> D[Upload photos]
    D --> E[Submit listing]
    E --> F[Pending admin approval]
    F --> G{Admin decision}
    G -- Approved --> H[Listing becomes active]
    G -- Rejected --> I[Seller edits and resubmits]
    H --> J[Receive buyer messages]
    J --> K[Mark listing sold]
```

---

## 23. Typical Administrator Journey

```mermaid
flowchart TD
    A[Open admin dashboard] --> B[Authenticate]
    B --> C[Review pending listings]
    C --> D{Valid listing?}
    D -- Yes --> E[Approve]
    D -- No --> F[Reject]
    E --> G[Listing visible publicly]
    F --> H[Seller may edit and resubmit]

    B --> I[Review reports]
    I --> J[Resolve report or moderate account]
```

---

## 24. Error Handling Flow

```mermaid
flowchart TD
    Request[Frontend sends request] --> API[Backend]
    API --> Check{Successful?}
    Check -- Yes --> Success[Return expected JSON]
    Check -- No --> Filter[Global exception filter]
    Filter --> Response[Return consistent error response]
    Response --> Frontend[Show user-friendly message]
```

The frontend should handle:

- No internet connection
- Backend unavailable or sleeping
- Invalid or expired OTP
- Expired access token
- Unauthorized or forbidden request
- Invalid listing data
- Upload failure
- Empty results
- Server validation errors

---

## 25. Quick Summary

PocketTrade follows this core pattern:

```mermaid
flowchart LR
    Person[User or Admin] --> Interface[Flutter App or React Dashboard]
    Interface --> Backend[NestJS API]
    Backend --> Database[(PostgreSQL)]
    Backend --> External[Mailjet, Cloudinary, Firebase]
    Backend --> Interface
    Interface --> Person
```

The frontend is responsible for displaying information and collecting input.

The backend is responsible for security, validation, permissions, moderation, and business rules.

The database is the permanent source of application data.

External services handle email delivery, image storage, and push notifications.

---

## 26. Source-of-Truth Files

When implementation details differ from this overview, check these areas in the repository:

```text
backend/src/                 NestJS modules, controllers, and services
backend/prisma/schema.prisma Database models and relationships
backend/prisma/migrations/   Database migration history
mobile/lib/                  Flutter screens, models, API calls, and routing
admin/src/                   React dashboard pages and API calls
Dockerfile                   Production backend image
.env.example                 Required configuration names
```

Update this document whenever a major authentication, listing, moderation, messaging, or deployment flow changes.
