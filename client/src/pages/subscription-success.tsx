import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';

export default function SubscriptionSuccessPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const { refreshCurrentOrganization } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentId = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    
    if (!paymentIntentId || !paymentIntentClientSecret) {
      toast({
        title: "Invalid Request",
        description: "Missing payment information. Please try subscribing again.",
        variant: "destructive",
      });
      navigate("/subscribe");
      return;
    }
    
    const verifyPayment = async () => {
      try {
        const response = await apiRequest(
          'POST', 
          '/api/verify-subscription', 
          { paymentIntentId, paymentIntentClientSecret }
        );
        
        if (response.ok) {
          setVerified(true);
          // Refresh organization data to get updated subscription status
          if (refreshCurrentOrganization) {
            await refreshCurrentOrganization();
          }
          
          toast({
            title: "Subscription Activated",
            description: "Your subscription has been successfully activated!",
          });
        } else {
          const data = await response.json();
          toast({
            title: "Verification Failed",
            description: data.message || "Unable to verify your subscription. Please contact support.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error verifying subscription:', error);
        toast({
          title: "Verification Error",
          description: "There was a problem verifying your subscription. Please contact support.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyPayment();
  }, [location, navigate, toast, refreshCurrentOrganization]);
  
  return (
    <div className="container flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Subscription Status</CardTitle>
          <CardDescription>
            {isVerifying ? 'Verifying your subscription...' : verified ? 'Your subscription is active!' : 'Verification issue'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          {isVerifying ? (
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          ) : verified ? (
            <CheckCircle className="h-16 w-16 text-green-500" />
          ) : (
            <div className="text-red-500 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4">We couldn't verify your subscription.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate("/")}
            disabled={isVerifying}
          >
            {verified ? 'Go to Dashboard' : 'Return to Home'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}