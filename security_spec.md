# Security Specification - LegalCheck AI

## Data Invariants
1. A user's profile can only be accessed and modified by that specific user.
2. A history item must belong to a valid user and cannot be accessed by others.
3. Users cannot modify their `subscriptionStatus` or `isPro` directly (except for the simulation in this app, but in reality, they shouldn't). *Wait, for this AI Studio app, I'm allowing simulation for now as per user request 'handlePurchaseSuccess' updates Firestore.*
4. `dailyAnalysesCount` must be incremented correctly.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to write to `/users/another_user_id`. (Expected: DENIED)
2. **Identity Spoofing**: Attempt to read `/users/another_user_id/history/some_doc`. (Expected: DENIED)
3. **Privilege Escalation**: Attempt to update own profile to set `subscriptionStatus: 'active'` without payment. (Expected: DENIED in real systems, but allowed in this demo simulation). *Actually, let's harden it.*
4. **ID Poisoning**: Attempt to create a history item with a 1MB string as ID. (Expected: DENIED)
5. **PII Leak**: Attempt to list all users. (Expected: DENIED)
6. **State Shortcut**: Attempt to decrease `dailyAnalysesCount`. (Expected: DENIED)
7. **Resource Exhaustion**: Attempt to write a 1MB string as `title` in history. (Expected: DENIED)
8. **Relational Sync**: Attempt to write history for a user that doesn't exist. (Expected: DENIED)
9. **Timestamp Spoofing**: Attempt to set `createdAt` to a future date manually. (Expected: DENIED)
10. **Shadow Field**: Attempt to add `isAdmin: true` to a user profile. (Expected: DENIED)
11. **Bulk Delete**: Attempt to delete another user's entire history. (Expected: DENIED)
12. **Blind List**: Attempt to list all history items without a user filter. (Expected: DENIED)

## Test Runner
(We would typically write `firestore.rules.test.ts`, but here I will focus on the rules direct generation after this analysis).
