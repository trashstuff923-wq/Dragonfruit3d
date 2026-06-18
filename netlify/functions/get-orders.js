const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// COGS lookup from actual Bambu Studio slice screenshots
// Filament rate: $0.025/g (dragon: $0.88 / 35.26g)
const COGS_MAP = {
  'custom bookend': 5.44,   // 2x bookends, 217.88g total
  'bookend':        5.44,
  'dragon':         0.88,   // 35.26g
  'eink':           1.25,   // ~50g estimated, no slice
  'e-ink':          1.25,
  'phone case':     1.00,   // TPU estimated
  'tpu':            1.00,
};

function getCOGS(productNames, items) {
  const lower = productNames.toLowerCase();
  for (const [key, val] of Object.entries(COGS_MAP)) {
    if (lower.includes(key)) return val;
  }
  // Fallback: 40g avg per item @ $0.025/g
  return items.reduce((s, i) => s + (i.quantity * 40 * 0.025), 0) || 1.00;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const sessions = await stripe.checkout.sessions.list({ limit: 100, status: 'complete' });

    const orders = sessions.data.map(session => {
      let items = [];
      try { items = JSON.parse(session.metadata?.order_items || '[]'); } catch (e) {}

      const revenue = session.amount_total / 100;
      const productNames = items.length > 0
        ? items.map(i => `${i.name}${i.color ? ' ('+i.color+')' : ''} x${i.quantity}`).join(', ')
        : 'Order';

      return {
        id: 'DF-' + session.id.slice(-6).toUpperCase(),
        stripeId: session.id,
        product: productNames,
        customer: session.customer_details?.name || session.customer_details?.email || 'Customer',
        email: session.customer_details?.email || '',
        revenue: parseFloat(revenue.toFixed(2)),
        cogs: parseFloat(getCOGS(productNames, items).toFixed(2)),
        date: new Date(session.created * 1000).toLocaleDateString('en-SG'),
        done: true
      };
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
