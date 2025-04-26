require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.post('/start-payment-setup', async (req, res) => {
  try {
    const { PaymentToken, CallSid, Result } = req.body;

    // Validate payment was successful
    if (Result !== 'success' || !PaymentToken) {
      throw new Error('Payment failed or token missing');
    }

    // Process Stripe subscription
    const customer = await stripe.customers.create();
    await stripe.paymentMethods.attach(PaymentToken, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: PaymentToken,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: 'price_1RFBXvAOy2W6vlFokwIELKQX' }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
    });

    console.log('✅ Subscription created for customer:', customer.id);

       // TwiML continues the Studio flow
       res.set('Content-Type', 'text/xml');
        res.send(`
          <Response>
            <Say>Thank you! Your payment was processed successfully.</Say>
            <Redirect method="POST">https://webhooks.twilio.com/v1/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Flows/${process.env.STUDIO_FLOW_SID}?FlowEvent=return</Redirect>
          </Response>
        `);

   
     } catch (err) {
       console.error('Payment processing error:', err);
       res.set('Content-Type', 'text/xml');
       res.send(`
         <Response>
           <Say>We encountered an error processing your payment. Please try again later.</Say>
           <Hangup/>
         </Response>
       `);
     }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
