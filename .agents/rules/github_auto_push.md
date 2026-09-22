# GitHub Auto-Push Rule

Whenever you make any code or configuration changes requested by the user, after completing and testing the change, you MUST automatically commit and push the changes to the GitHub repository. Do not wait for the user to ask you to push.

## Workflow Every Time:
1. Make the requested changes.
2. Check/test that the change works and there are no obvious errors.
3. Run `git status`.
4. Commit all relevant changed files with a clear commit message.
5. Push the commit to the current production branch (`master`).
6. Confirm to the user that the push was successful and report the commit hash.

## Security & Secrets Protection:
- NEVER commit `.env`, secrets, API keys, passwords, private credentials, or other sensitive files.
- If a change involves environment variables, update the appropriate `.env.example` if needed, but keep real secrets out of GitHub.
- This rule applies to every future code change in this project unless explicitly instructed otherwise.
