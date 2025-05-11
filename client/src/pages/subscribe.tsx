import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscriptionForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!stripe || !elements) {
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscription-success`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      toast({
        title: "Payment Failed",
        description: "Something went wrong with the payment process.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit"
        disabled={!stripe || isSubmitting} 
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Subscribe Now"
        )}
      </Button>
    </form>
  );
};

const PricingCard = ({ 
  title, 
  price, 
  description, 
  features, 
  onSelect 
}: { 
  title: string; 
  price: number; 
  description: string; 
  features: string[]; 
  onSelect: () => void; 
}) => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="mt-2 text-3xl font-bold">${price}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onSelect} 
          className="w-full"
        >
          Select Plan
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function SubscribePage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, currentOrganization } = useAuth();

  const plans = [
    {
      id: 'starter',
      title: 'Starter Plan',
      price: 49,
      description: 'Perfect for small repair shops',
      features: [
        'Up to 5 users',
        '500 repair tickets/month',
        'Customer management',
        'Basic reporting',
        'Email notifications'
      ]
    },
    {
      id: 'business',
      title: 'Business Plan',
      price: 99,
      description: 'Great for growing businesses',
      features: [
        'Up to 15 users',
        'Unlimited repair tickets',
        'Advanced reporting',
        'Inventory management',
        'SMS notifications',
        'API access'
      ]
    },
    {
      id: 'enterprise',
      title: 'Enterprise Plan',
      price: 199,
      description: 'For large repair operations',
      features: [
        'Unlimited users',
        'Unlimited repair tickets',
        'Custom branding',
        'Advanced analytics',
        'Priority support',
        'Dedicated account manager',
        'SLA guarantees'
      ]
    }
  ];

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    
    if (!currentOrganization) {
      toast({
        title: "Organization Required",
        description: "Please create or select an organization before subscribing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/subscriptions', { 
        planId,
        organizationId: currentOrganization.id 
      });
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast({
        title: "Subscription Error",
        description: "There was a problem setting up your subscription. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!clientSecret && !selectedPlan) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Choose Your Subscription Plan</h1>
          <p className="text-muted-foreground mt-2">
            Select the plan that best fits your repair shop's needs
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              title={plan.title}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              onSelect={() => handleSelectPlan(plan.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!clientSecret && selectedPlan) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p>Setting up your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Subscription</CardTitle>
            <CardDescription>
              Enter your payment details to subscribe to the {
                plans.find(p => p.id === selectedPlan)?.title
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret: clientSecret! }}>
              <SubscriptionForm />
            </Elements>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}