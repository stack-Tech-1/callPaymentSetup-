require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Twilio = require('twilio'); 

const app = express();

// Verify environment variables
const requiredVars = ['STRIPE_SECRET_KEY', 'TWILIO_ACCOUNT_SID', 'STUDIO_FLOW_SID'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Twilio endpoint
app.post('/twilio-payment-handler', (req, res) => {
  try {
    const twiml = new Twilio.twiml.VoiceResponse();
    
    twiml.say("We are saving your card for future monthly payments.");
    twiml.pay({
      paymentConnector: "Stripe_Connector_2",
      tokenType: "payment-method",
      postalCode: false,
      action: "https://callpaymentsetup.onrender.com/start-payment-setup" 
    });

    res.type('text/xml');
    res.send(timl.toString());
  } catch (err) {
    console.error('Twilio handler error:', err);
    res.status(500).send('Server error');
  }
});

// Payment processing endpoint
app.post('/start-payment-setup', async (req, res) => {
  try {
    console.log('Payment webhook received:', req.body); 
    
    const { PaymentToken, Result } = req.body;
    if (Result !== 'success' || !PaymentToken) {
      throw new Error(`Payment failed - Result: ${Result}, Token: ${!!PaymentToken}`);
    }

    // Process Stripe subscription
    const customer = await stripe.customers.create();
    await stripe.paymentMethods.attach(PaymentToken, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: PaymentToken }
    });

    await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: 'price_1RFBXvAOy2W6vlFokwIELKQX' }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      }
    });

    console.log('✅ Subscription created for:', customer.id);

    // TwiML response
    res.type('text/xml').send(`
      <Response>
        <Redirect method="POST">https://webhooks.twilio.com/v1/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Flows/${process.env.STUDIO_FLOW_SID}?FlowEvent=return</Redirect>
      </Response>
    `);

  } catch (err) {
    console.error('❌ Payment processing failed:', err);
    res.type('text/xml').send(`
      <Response>
        <Say>Error: ${err.message.replace(/[^\w\s]/gi, '')}</Say>
        <Hangup/>
      </Response>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});