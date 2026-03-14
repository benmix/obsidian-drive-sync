# Verification Steps

This file lists the manual checks that still matter even when lint, tests, and build are green.

## Authentication And Session Lifecycle

1. In Obsidian, run **Sign in to remote provider**.
2. Enter provider credentials and any required 2FA or mailbox password.
3. Confirm a success notice appears.
4. Open **Show sync status** and confirm auth status is healthy.
5. Close and reopen Obsidian.
6. Run **Connect remote provider** and confirm the session restores without a fresh login.
7. Run **Sign out of remote provider** and confirm the session is cleared.

Expected result:

- login succeeds
- session restore works across restart
- logout clears the stored session and updates the status UI

## Remote Operations And UID Stability

1. Make sure a **Remote folder** is selected.
2. Run **Validate remote operations**.
3. Confirm the command succeeds.
4. If it fails, inspect the dev console and structured logs for the failing step.

The validation flow covers:

- `list` on the remote root
- `create` of a test folder
- `upload` of a test file
- `download` and content comparison
- a second `upload` that changes the remote revision without changing the node `uid`
- `move` and rename while keeping the same node `uid`
- `delete` plus cleanup of the test folder

Expected result:

- every step succeeds
- the node `uid` stays stable across rename and new revisions
- cleanup completes and leaves no test artifacts behind
