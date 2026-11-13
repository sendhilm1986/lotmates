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
    return send({ success: false, message: 'Send the refund details as JSON' }, 400);
  }

  const paymentId = String(body.paymentId || '');
  const amount = Math.round(Number(body.amount));
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return send({ success: false, message: 'A Razorpay payment id (pay_...) is required' }, 400);
  }
  if (!amount || amount < 100) {
    return send({ success: false, message: 'Refund must be at least 100 paise' }, 400);
  }

  const keyId = await apper.getSecret('RAZORPAY_KEY_ID');
  const keySecret = await apper.getSecret('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    return send({ success: false, message: 'Razorpay test keys are not set yet' }, 503);
  }
  if (!String(keyId).startsWith('rzp_test_')) {
    return send({ success: false, message: 'This demo only accepts Razorpay test keys' }, 403);
  }

  const auth = btoa(keyId + ':' + keySecret);
  let res;
  try {
    res = await fetch('https://api.razorpay.com/v1/payments/' + paymentId + '/refund', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        speed: 'normal',
        notes: { reason: String(body.reason || 'Lotmates refund').slice(0, 200) },
      }),
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
    const reason = data && data.error && data.error.description ? data.error.description : 'Razorpay rejected the refund';
    return send({ success: false, message: reason }, 502);
  }

  return send({ success: true, data: { refundId: data.id, amount: data.amount, status: data.status } });
});
