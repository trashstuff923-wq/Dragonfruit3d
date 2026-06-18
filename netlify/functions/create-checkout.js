const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { items } = JSON.parse(event.body);

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'sgd',
        product_data: {
          name: item.name,
          description: `Color: ${item.color || 'Yellow'}`,
          metadata: {
            color: item.color || 'Yellow',
            product_id: item.id.toString()
          }
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item
    lineItems.push({
      price_data: {
        currency: 'sgd',
        product_data: {
          name: 'Shipping & Taxes',
          description: 'Standard Delivery',
        },
        unit_amount: 600, // $6.00 in cents
      },
      quantity: 1,
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paynow', 'grabpay'],
      line_items: lineItems,
      mode: 'payment',
      // Enable promotion codes: shows an "Add promo code" field at Stripe Checkout.
      // Customers can then enter any active coupon you've set up in the Stripe Dashboard.
      // Without this flag set to true, the field doesn't render and no coupons can be used.
      allow_promotion_codes: true,
      success_url: `${event.headers.origin}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${event.headers.origin}?canceled=true`,
      shipping_address_collection: {
        allowed_countries: ['SG'],
      },
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        order_items: JSON.stringify(items.map(item => ({
          name: item.name,
          color: item.color,
          quantity: item.quantity,
          price: item.price
        })))
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        id: session.id,
        url: session.url 
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message 
      })
    };
  }
};
