import React, { useState } from 'react';
import { CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { API_URL, RAZORPAY_KEY_ID } from '../config';

/**
 * Standard Razorpay Web Checkout Button
 * Integrates Razorpay standard checkout flow:
 * 1. Calls /api/create-order
 * 2. Opens native Razorpay checkout frame
 * 3. Verifies signature via /api/verify-payment
 */
export default function RazorpayPayButton({
  amount = 100, // Amount in Paise (minimum 100) or specify amountInRupees
  amountInRupees = null,
  currency = 'INR',
  name = 'ContaQue Technologies',
  description = 'Lead OS Service Payment',
  prefill = {},
  notes = {},
  buttonText = 'Pay with Razorpay',
  className = '',
  style = {},
  disabled = false,
  onSuccess,
  onError,
  onDismiss
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePayment = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      // 1. Calculate amount in paise (minimum 100 paise = ₹1)
      let finalAmountInPaise = amount;
      if (amountInRupees !== null) {
        finalAmountInPaise = Math.round(amountInRupees * 100);
      }
      if (finalAmountInPaise < 100) {
        throw new Error('Minimum payment amount is ₹1.00 (100 paise)');
      }

      // 2. Check Razorpay SDK is loaded from index.html
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection or ad-blocker.');
      }

      // 3. Step 1: Call Backend to Create Order
      const createOrderRes = await fetch(`${API_URL}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmountInPaise,
          currency,
          notes
        })
      });

      const orderData = await createOrderRes.json();
      if (!createOrderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      const activeKey = orderData.key_id || RAZORPAY_KEY_ID;

      // 4. Step 2: Configure Razorpay Checkout Options
      const options = {
        key: activeKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name,
        description,
        order_id: orderData.order_id,
        prefill: {
          name: prefill.name || '',
          email: prefill.email || '',
          contact: prefill.phone || prefill.contact || ''
        },
        theme: {
          color: '#1f1d19'
        },
        handler: async (response) => {
          try {
            // Step 3: Backend Signature Verification
            const verifyRes = await fetch(`${API_URL}/api/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Cryptographic payment verification failed.');
            }

            setLoading(false);
            if (onSuccess) {
              onSuccess({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                message: verifyData.message
              });
            }
          } catch (vErr) {
            console.error('[Razorpay Verification Error]:', vErr);
            const msg = vErr.message || 'Payment verification failed on the server.';
            setErrorMessage(msg);
            setLoading(false);
            if (onError) onError(msg);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            if (onDismiss) onDismiss();
          }
        }
      };

      // 5. Open Native Razorpay Modal
      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', (failResponse) => {
        console.error('[Razorpay Payment Failed]:', failResponse.error);
        const failMsg = failResponse.error?.description || 'Payment was unsuccessful or declined by bank.';
        setErrorMessage(failMsg);
        setLoading(false);
        if (onError) onError(failMsg, failResponse.error);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('[Razorpay Checkout Error]:', err);
      const msg = err.message || 'An error occurred while launching payment.';
      setErrorMessage(msg);
      setLoading(false);
      if (onError) onError(msg);
    }
  };

  return (
    <div className="razorpay-btn-wrapper" style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={handlePayment}
        disabled={disabled || loading}
        className={className || "btn-razorpay-standard"}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: disabled || loading ? 0.7 : 1,
          ...style
        }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard size={16} />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
