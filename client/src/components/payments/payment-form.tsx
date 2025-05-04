import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement, Elements, AddressElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Load the Stripe public key from environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentFormProps {
  invoiceId: number;
  total: number;
  isOpen: boolean;
  onClose: () => void;
}

// Main payment form wrapper
export default function PaymentForm({ invoiceId, total, isOpen, onClose }: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPaymentIntent = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await apiRequest(
          "POST", 
          `/api/invoices/${invoiceId}/create-payment-intent`, 
          { amount: total }
        );
        
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError("Could not initialize payment. Please try again.");
        }
      } catch (err) {
        console.error("Error creating payment intent:", err);
        setError("Failed to initialize payment. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen && invoiceId && total) {
      fetchPaymentIntent();
    }
  }, [invoiceId, total, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pay Invoice</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {!isLoading && !error && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onClose={onClose} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Inner checkout form with Stripe elements
function CheckoutForm({ onClose }: { onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      if (error) {
        setPaymentError(error.message || "An error occurred with your payment");
        toast({
          title: "Payment failed",
          description: error.message || "An unknown error occurred",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: "Payment successful!",
          description: "Your payment has been processed successfully",
        });
        onClose();
      }
    } catch (err) {
      console.error("Payment confirmation error:", err);
      setPaymentError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 my-4">
        <PaymentElement />
        
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Billing Address</h3>
          <AddressElement options={{ mode: 'billing' }} />
        </div>
      </div>

      {paymentError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
          {paymentError}
        </div>
      )}

      <DialogFooter className="mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isSubmitting}
          className={isSubmitting ? "opacity-70" : ""}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Processing...
            </span>
          ) : (
            `Pay $${(Math.round(elements?.getElement(PaymentElement)?.options?.amount || 0) / 100).toFixed(2)}`
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}