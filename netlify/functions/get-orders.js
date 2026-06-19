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

  // --- ACCESS CONTROL (added after VibeProd security scan flagged this endpoint) ---
  // This endpoint returns customer names, emails, revenue and profit margins, so it
  // MUST NOT be public. Require a secret admin key supplied via the 'x-admin-key' header,
  // matched against the ADMIN_KEY environment variable set in the Netlify dashboard.
  // The key is NEVER stored in the code or the repo. If ADMIN_KEY isn't configured, deny.
  const adminKey = process.env.ADMIN_KEY;
  const provided = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
  if (!adminKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Admin access not configured. Set ADMIN_KEY in Netlify environment variables.' }) };
  }
  if (!provided || provided !== adminKey) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const sessions = await stripe.checkout.sessions.list({ limit: 100, status: 'complete' });

    const orders = sessions.data.map(session => {
      let items = [];
      try { items = JSON.parse(session.metadata?.order_items || '[]'); }
      catch (e) { console.warn('Could not parse order_items for session', session.id, e.message); }

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
      // Locked to the site's own origin instead of '*' so other sites can't read order data.
      headers: { 'Access-Control-Allow-Origin': 'https://dragonfruit3d.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
