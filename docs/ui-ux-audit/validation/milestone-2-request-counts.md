# Milestone 2 intercepted request counts

The application endpoint is deliberately unchanged: TanStack Start `POST /_serverFn/<opaque-id>`. The payment sheet uses `createCheckoutSession`; account deletion uses `requestMyAccountDeletion`.

| Flow | Scenario | Expected | Actual | Status |
| --- | --- | ---: | ---: | --- |
| Payment | Rapid double-click | 1 | Not captured in a completed run | Open |
| Payment | Repeated Enter | 1 | Not captured in a completed run | Open |
| Payment | Repeated Space | 1 | Not captured in a completed run | Open |
| Payment | Initial error | 1 | Not captured in a completed run | Open |
| Payment | Retry after error | 1 additional | Not captured in a completed run | Open |
| Payment | Refresh / browser back | 0 | Not captured in a completed run | Open |
| Deletion | Rapid double-click | 1 | Not captured in a completed run | Open |
| Deletion | Repeated Enter | 1 | Not captured in a completed run | Open |
| Deletion | Repeated Space | 1 | Not captured in a completed run | Open |
| Deletion | Initial error | 1 | Not captured in a completed run | Open |
| Deletion | Retry after error | 1 additional | Not captured in a completed run | Open |
| Deletion | Refresh / browser back after success | 0 | Not captured in a completed run | Open |

No payment-session or deletion-request mutation was forwarded to a real application side effect during this pass.
