apper.serve(async (req) => {
  const send = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return send({ success: false, message: 'Send the payment details as JSON' }, 400);
  }

  const amount = Math.round(Number(body.amount));
  if (!amount || amount < 100) {
    return send({ success: false, message: 'Amount must be at least 100 paise' }, 400);
  }
  if (amount > 50000000) {
    return send({ success: false, message: 'Amount is above the demo limit of 5,00,000 rupees' }, 400);
  }

  const keyId = await apper.getSecret('RAZORPAY_KEY_ID');
  const keySecret = await apper.getSecret('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    return send({ success: false, message: 'Razorpay test keys are not set yet' }, 503);
  }
  if (!String(keyId).startsWith('rzp_test_')) {
    return send({ success: false, message: 'This demo only accepts Razorpay test keys' }, 403);
  }

  const notes = {};
  const rawNotes = body.notes && typeof body.notes === 'object' ? body.notes : {};
  Object.keys(rawNotes)
    .slice(0, 10)
    .forEach((k) => {
      notes[String(k).slice(0, 40)] = String(rawNotes[k]).slice(0, 200);
    });

  const payload = {
    amount,
    currency: 'INR',
    receipt: String(body.receipt || 'lotmates').slice(0, 40),
    notes,
  };

  const auth = btoa(keyId + ':' + keySecret);
  let res;
  try {
    res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return send({ success: false, message: 'Could not reach Razorpay' }, 502);
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (!res.ok) {
    const reason = data && data.error && data.error.description ? data.error.description : 'Razorpay rejected the order';
    return send({ success: false, message: reason }, 502);
  }

  return send({
    success: true,
    data: {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
    },
  });
});
