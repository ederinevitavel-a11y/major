# Security Specification - Major Applet (Hardened ABAC & PII Isolation)

## 1. Data Invariants & Privacy Protection (Zero-Trust Architecture)
- **PII Isolation (Zero Data Exposure)**:
  - User emails, contact data, and personal details are strictly isolated from regular guild members.
  - `allowed_emails`: Only administrators can list the authorized email directory. Regular authenticated users can ONLY evaluate their own specific email document (`request.auth.token.email == resource.data.email`) to check authorization. No member can harvest or enumerate other members' emails.
  - `users/{userId}`: Standard users can ONLY read their own profile (`request.auth.uid == userId`). The `users` collection cannot be listed (`allow list: if isAdmin();`) by non-admins, preventing automated scraping or mass PII extraction via DevTools.
  - `reservations/{reservationId}`: Respawns only record in-game character identities (`charName`, `userRank`) and party roles. No email or personal contact information is ever stored or broadcast in reservation documents.
  - Input sanitization blocks accidental sharing of email patterns or phone numbers in party descriptions or notes.
- **Admin Privilege & Role Escalation Protection**:
  - Privilege is restricted to bootstrapped admin (`ederinevitavel@gmail.com`) with `email_verified == true` and explicit documents in `/admins/`.
  - Non-admin users cannot elevate their own permissions or set `isAdmin: true`.
  - Admins can manage character linkages, assign slots, and audit authorized email lists.
- **Reservation Integrity**:
  - Members can create reservations with their authenticated UID.
  - Non-admins can only update or cancel reservations they own (`resource.data.userUid == request.auth.uid`).
  - Admins can override, assign to other members, or release any slot.

## 2. Hardened Test Scenarios & Denial Verification
1. Non-admin authenticated user attempts `getDocs(collection(db, 'allowed_emails'))`. (Expected: PERMISSION_DENIED)
2. Non-admin user attempts `getDoc(doc(db, 'allowed_emails', 'other_user@gmail.com'))`. (Expected: PERMISSION_DENIED)
3. Non-admin authenticated user attempts `getDocs(collection(db, 'users'))`. (Expected: PERMISSION_DENIED)
4. User 'alice' attempts `getDoc(doc(db, 'users', 'bob_uid'))`. (Expected: PERMISSION_DENIED)
5. User 'alice' attempts to overwrite user 'bob' profile in `/users/bob_uid`. (Expected: PERMISSION_DENIED)
6. Non-admin user attempts to create a profile with `isAdmin: true`. (Expected: PERMISSION_DENIED)
7. Non-admin user attempts to add an email to `/allowed_emails`. (Expected: PERMISSION_DENIED)
8. User 'alice' attempts to delete user 'bob' reservation in `/reservations/res_1`. (Expected: PERMISSION_DENIED)
9. Unauthenticated user attempts to read or write any collection. (Expected: PERMISSION_DENIED)
10. Spoofed email payload claiming to be admin with `email_verified == false`. (Expected: PERMISSION_DENIED)
11. User attempts to inject fields exceeding length constraints or invalid IDs. (Expected: PERMISSION_DENIED)
12. Anonymous write attempts to `/admins` or `/guild_settings`. (Expected: PERMISSION_DENIED)
