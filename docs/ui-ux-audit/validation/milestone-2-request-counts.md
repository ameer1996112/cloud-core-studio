# Milestone 2 intercepted request counts

The application endpoints were not changed. Tests classified the two TanStack Start mutations by serialized payload signature, request origin/method, and calling action; then required distinct, stable generated paths across scenarios. Unrecognized `POST /_serverFn/*` requests failed closed. No mutation reached a remote service.

- Payment: `POST /_serverFn/4d3f9eb3778935f79cea7886fb47c37468e8968a691763e74686e50401eb56a8`, payload signature includes the selected package/plan identifier and checkout method; success requires `status: "ready"`, `provider: "hyp"`, `payment_id`, and `checkout_url`.
- Deletion: `POST /_serverFn/319b2500137ce249ac571c2c9fdce3856a28dc788a58f9f4e16a68e2a8a2a418`, authenticated deletion action payload; success requires `ok: true` and a string `status`.

| Payment scenario | Expected | Actual | Pass/fail |
| --- | ---: | ---: | --- |
| Opening payment sheet | 0 | 0 | Pass |
| Rapid double-click | 1 | 1 | Pass |
| Repeated Enter | 1 | 1 | Pass |
| Repeated Space | 1 | 1 | Pass |
| Initial server error | 1 | 1 | Pass |
| Retry after server error | 1 additional | 1 additional | Pass |
| Network error | 1 | 1 | Pass |
| Invalid response | 1 | 1 | Pass |
| Missing redirect URL | 1 | 1 | Pass |
| Unknown status | 1 | 1 | Pass |
| Invalid JSON | 1 | 1 | Pass |
| Successful handoff | 1 | 1 | Pass |
| Refresh before submit | 0 | 0 | Pass |
| Browser back before submit | 0 | 0 | Pass |

| Deletion scenario | Expected | Actual | Pass/fail |
| --- | ---: | ---: | --- |
| Open confirmation dialog | 0 | 0 | Pass |
| Cancel confirmation | 0 | 0 | Pass |
| Escape from dialog | 0 | 0 | Pass |
| Rapid double-click | 1 | 1 | Pass |
| Repeated Enter | 1 | 1 | Pass |
| Repeated Space | 1 | 1 | Pass |
| Initial server error | 1 | 1 | Pass |
| Retry after server error | 1 additional | 1 additional | Pass |
| Validation error | 1 | 1 | Pass |
| Network error | 1 | 1 | Pass |
| Invalid response | 1 | 1 | Pass |
| Invalid JSON | 1 | 1 | Pass |
| Successful request | 1 | 1 | Pass |
| Refresh after success | 0 | 0 | Pass |
| Browser back after success | 0 | 0 | Pass |

The payment handoff used a loopback Playwright destination and is UI-contract/handoff verification, not HYP integration testing. The deletion success was intercepted and did not delete the fixture.
