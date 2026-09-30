# Express Checkout — Manual QA Checklist

Run after deploy to production (Apple Pay cannot be tested locally or in CI).

## Apple Pay (Safari, macOS or iOS, with a card in Wallet)
- [ ] Visit /checkout with an item in the cart — Apple Pay button appears in the Express Checkout row
- [ ] Tap the button, choose an address in the Apple Pay sheet — shipping cost and total update live inside the sheet
- [ ] Approve payment — order is created already paid, redirects to /checkout/success
- [ ] Order in admin (Orders list) shows payment_gateway = stripe, correct total, correct address

## Google Pay (Chrome, with a saved card)
- [ ] Same checklist as Apple Pay above, substituting the Google Pay button

## PayPal Express (any browser)
- [ ] PayPal button appears in the Express Checkout row
- [ ] Click it, choose/confirm address in the PayPal popup — shipping cost and total update live
- [ ] Approve payment — order is created already paid, redirects to /checkout/success
- [ ] Order in admin shows payment_gateway = paypal, payment captured

## No wallet available (e.g. desktop Firefox with no PayPal account logged in anywhere)
- [ ] Express Checkout row (including "Express checkout" label and "Or" divider) does not render at all
- [ ] Regular form checkout still works unchanged

## Regression
- [ ] Existing in-form "Pay with PayPal" (below the Express row, inside Payment section) still redirects/opens a popup exactly as before
- [ ] Existing card form (typed card number) still works exactly as before
