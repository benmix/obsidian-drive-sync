# Verification Steps

## Authentication and session lifecycle

1. In Obsidian, run the command **Sign in to Proton Drive**.
2. Enter your Proton credentials (and 2FA/mailbox password if prompted).
3. Confirm a success notice appears and **Show Proton Drive sync status** reports Auth status as OK.
4. Close and reopen Obsidian.
5. Run **Connect to Proton Drive** to confirm session restore works without re-auth.
6. Run **Sign out of Proton Drive** and confirm status shows session cleared.

## Remote operations (CRUD) and UID stability

1. Ensure **Enable Proton Drive integration** is on and a **Remote folder ID** is set.
2. Run **Validate Proton Drive remote operations**.
3. Confirm a success notice appears.
4. If validation fails, open the dev console to review the failed step.

The validation runs:

- `list` on the remote root
- `create` a test folder
- `upload` a test file
- `download` and compare content
- `upload` a new revision and confirm the node `uid` is stable while the revision changes
- `move` and rename the node and confirm the `uid` stays stable
- `delete` the node and cleanup the test folder
