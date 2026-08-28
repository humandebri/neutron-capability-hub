# Cycles Checkout

Stripe-backed cycles top-up coordinator. The target canister is derived by the
Stripe service from the immediate Neutron caller and is never accepted from the
browser. Backend access is reserved to four exact methods.

Neutron's normal tile CSP intentionally blocks Stripe.js and its sandbox blocks
3DS navigation. Card entry therefore uses the hosted checkout page; the client
secret is passed in a URL fragment, while order creation, finalization, and
top-up remain bound to Neutron.

```sh
npm --workspace neutron-cycles-checkout test
```
