// Custom-amount checkout — used by /pay.html at in-person events (park stalls, markets).
// The seller types the amount on their phone, the buyer scans/pays with PayNow, card or GrabPay.
// NOTE: the amount is re-validated here on the server. Never trust the amount sent by the browser.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const MIN_SGD = 1;      // reject silly/zero payments
const MAX_SGD = 500;    // sanity cap so a typo can't create a $99,999 charge

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { amount, note } = JSON.parse(event.body || '{}');

    const value = Number(amount);
    if (!isFinite(value) || value < MIN_SGD || value > MAX_SGD) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Amount must be between $${MIN_SGD} and $${MAX_SGD}.` })
      };
    }

    // Keep the note short and plain so it can't be used to inject anything odd into Stripe.
    const clean = String(note || '').replace(/[^\w \-.,&']/g, '').slice(0, 60);
    const origin = event.headers.origin || 'https://dragonfruit3d.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['paynow', 'card', 'grabpay'],   // PayNow first — most common in SG
      line_items: [{
        price_data: {
          currency: 'sgd',
          product_data: {
            name: 'Dragonfruit 3D — in-person purchase',
            description: clean || 'Item bought at our stall'
          },
          unit_amount: Math.round(value * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      // No shipping address: the customer is standing right here and takes the item with them.
      success_url: `${origin}/pay.html?paid=1&amt=${encodeURIComponent(value.toFixed(2))}`,
      cancel_url: `${origin}/pay.html?canceled=1`,
      metadata: { source: 'in-person', note: clean }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };

  } catch (error) {
    console.error('Custom payment error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
