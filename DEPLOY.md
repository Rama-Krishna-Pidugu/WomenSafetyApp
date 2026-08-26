# Backend deploy (Lambda)

The FastAPI backend (`backend/`) runs as a container-image Lambda, fronted by both a
Function URL and API Gateway. Deploys are **manual only** — there is no deploy-on-push,
deliberately, since this repo has multiple active collaborators and an accidental deploy
from someone else's push would be a bad surprise.

## What exists

| Thing | Value |
|---|---|
| AWS account | `943553143794` |
| Region | `ap-south-1` |
| ECR repo | `aegis-backend` |
| Lambda function | `aegis-backend` (container image, `x86_64`, `Active`) |
| Function URL | `https://rrudawfb6rl6zxgmh4e2iu4lfa0guuyc.lambda-url.ap-south-1.on.aws/` |
| API Gateway | `ywrqvm9zn0` (invokes the same Lambda) |
| GH Actions workflow | `.github/workflows/deploy-backend-lambda.yml` |

## Option A — GitHub Actions (preferred)

1. Push/merge whatever you want deployed to a branch on `origin`.
2. GitHub repo → **Actions** → **Deploy Backend to Lambda** → **Run workflow** → pick the branch → **Run workflow**.
   (Or: `gh workflow run deploy-backend-lambda.yml --ref <branch>`, needs `gh auth login` first.)
3. The workflow builds `backend/Dockerfile.lambda`, pushes to ECR as `:latest` and `:<sha>`, then
   `aws lambda update-function-code` + waits for the update to finish.
4. Auth is via GitHub OIDC → `arn:aws:iam::943553143794:role/aegis-backend-github-deploy-role`. No AWS keys stored in GitHub.

Only deploys what's actually committed and pushed — uncommitted local changes are invisible to this path.

## Option B — Local deploy (when you need uncommitted changes deployed, or CI/OIDC is down)

Prereqs: Docker Desktop running, AWS CLI configured with an identity that can push to the
`aegis-backend` ECR repo and call `lambda:UpdateFunctionCode` (locally this has been the
`pika-backend` IAM user — check with `aws sts get-caller-identity`).

```bash
cd backend

aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin 943553143794.dkr.ecr.ap-south-1.amazonaws.com

TAG=local-deploy-$(date +%Y%m%d%H%M%S)
docker build --platform linux/amd64 --provenance=false --sbom=false \
  -f Dockerfile.lambda \
  -t 943553143794.dkr.ecr.ap-south-1.amazonaws.com/aegis-backend:latest \
  -t 943553143794.dkr.ecr.ap-south-1.amazonaws.com/aegis-backend:$TAG \
  .

docker push 943553143794.dkr.ecr.ap-south-1.amazonaws.com/aegis-backend:latest
docker push 943553143794.dkr.ecr.ap-south-1.amazonaws.com/aegis-backend:$TAG

aws lambda update-function-code \
  --function-name aegis-backend \
  --image-uri 943553143794.dkr.ecr.ap-south-1.amazonaws.com/aegis-backend:$TAG \
  --region ap-south-1

aws lambda wait function-updated --function-name aegis-backend --region ap-south-1
```

`--platform linux/amd64` matters — the Lambda function's architecture is `x86_64`; building
without it on an ARM machine (or an ARM-backed Docker Desktop) produces an image Lambda can't run.

## Verifying a deploy

The Function URL currently returns `403 AccessDeniedException` for anonymous requests
(known issue, see below) — `curl`/browser against it is **not** a reliable health check
right now. Use a direct `lambda invoke` instead, which uses IAM auth and bypasses the
Function URL entirely:

```bash
echo '{"requestContext":{"http":{"method":"GET","path":"/"}},"rawPath":"/","headers":{}}' \
  | aws lambda invoke --function-name aegis-backend --region ap-south-1 \
      --cli-binary-format raw-in-base64-out --payload file:///dev/stdin out.json \
  && cat out.json
```

A healthy response looks like:
```json
{"statusCode": 200, "body": "{\"title\":\"Aegis AI Women Safety Backend\",...,\"status\":\"online\",...}"}
```

If `out.json` instead contains a Python traceback, the app crashed on import — check
`aws logs tail /aws/lambda/aegis-backend --since 10m --region ap-south-1` for the stack trace.
Because every `app/api/v1/**/router.py` is imported eagerly at startup
(`app/api/__init__.py` → `app/main.py`), **one broken router file crashes the entire
backend**, not just its own endpoints — this has bitten us before (see below).

## Known issues (unresolved, not caused by any one deploy)

- **Function URL returns 403** (`AccessDeniedException`) for every request, even though the
  resource policy explicitly allows anonymous `lambda:InvokeFunctionUrl` and the account
  isn't in an AWS Organization (so no SCP is involved). Root cause not yet found — treat the
  Function URL as unreliable until this is debugged. **The frontend (`frontend/.env`,
  `EXPO_PUBLIC_API_URL`) points at API Gateway instead**
  (`https://ywrqvm9zn0.execute-api.ap-south-1.amazonaws.com`), which is public and healthy —
  use that for any client that needs to reach the deployed backend, and for health checks,
  until the Function URL is fixed.
- **Secrets in plaintext Lambda env vars** — `FIREBASE_SERVICE_ACCOUNT_JSON` (private key
  included) and `SUPABASE_KEY` (service-role) are visible to anyone who can call
  `lambda:GetFunctionConfiguration` on this function. Worth moving to Secrets Manager /
  Parameter Store at some point; the Supabase key was rotated once already after a prior
  exposure.
- **2026-08-04 → 2026-08-24: `backend/app/api/v1/gps/router.py` had no imports at all**
  (`@router.post(...)` referencing an undefined `router`), and `backend/app/main.py` imported
  a `track_web_page` function that had been deleted from that same file during the live-location
  cleanup (see `docs/superpowers/specs/2026-08-23-live-location-wiring-design.md`). Both crashed
  the whole app on cold start and went unnoticed because nothing had actually invoked the
  deployed Lambda since 2026-08-13. Fixed 2026-08-24 — if a future refactor touches
  `backend/app/api/v1/**`, re-run the verify step above before assuming a deploy worked.
