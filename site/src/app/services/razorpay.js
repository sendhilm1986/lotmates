const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loader = null;

export function loadCheckout() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (!loader) {
    loader = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        loader = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return loader;
}

export function openCheckout(options) {
  return new Promise((resolve, reject) => {
    // A failed attempt keeps Razorpay open so the person can try another method;
    // only closing the window ends the attempt.
    let lastError = null;
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(Object.assign(new Error('Payment window closed before paying'), { dismissed: true, lastError })),
        escape: true,
        backdropclose: false,
      },
    });
    rzp.on('payment.failed', (r) => {
      lastError = r?.error?.description || 'Payment failed';
    });
    rzp.open();
  });
}

export const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);

export const isGatewayPayment = (ref) => typeof ref === 'string' && ref.startsWith('pay_');
