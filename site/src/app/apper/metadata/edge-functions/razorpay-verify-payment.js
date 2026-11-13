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
    return send({ success: false, message: 'Send the payment result as JSON' }, 400);
  }

  const orderId = String(body.orderId || '');
  const paymentId = String(body.paymentId || '');
  const signature = String(body.signature || '');
  if (!orderId || !paymentId || !signature) {
    return send({ success: false, message: 'Order id, payment id and signature are all required' }, 400);
  }

  const keySecret = await apper.getSecret('RAZORPAY_KEY_SECRET');
  if (!keySecret) {
    return send({ success: false, message: 'Razorpay test keys are not set yet' }, 503);
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(orderId + '|' + paymentId));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (hex !== signature) {
    return send({ success: false, message: 'Payment signature did not match. The booking was not recorded.' }, 400);
  }

  return send({ success: true, data: { valid: true, orderId, paymentId } });
});
