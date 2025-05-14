import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Helper function to format currency for preview display
function formatCurrencyPreview(amount: number | string | null | undefined, currencyCode?: string): string {
  // Handle undefined, null, or non-numeric values
  if (amount === undefined || amount === null) {
    return '-';
  }
  
  // Convert to number if it's a string
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN values
  if (isNaN(numericAmount)) {
    return '-';
  }
  
  // Use provided currency code or fallback to GBP
  let code = currencyCode || 'GBP';
  
  // Handle special currency codes with organization IDs (like USD_3)
  // Extract the base currency code (USD, EUR, etc.) from our special format
  if (code && code.includes('_')) {
    // Split by underscore and take the first part as the standard currency code
    code = code.split('_')[0];
  }
  
  // Ensure it's a valid 3-letter currency code for Intl.NumberFormat
  if (!code || code.length !== 3) {
    // Fallback to a safe default
    code = 'USD';
  }
  
  // Choose locale based on the currency code
  let locale: string;
  switch(code) {
    case 'GBP':
      locale = 'en-GB';
      break;
    case 'JPY':
      locale = 'ja-JP';
      break;
    case 'EUR':
      locale = 'de-DE';
      break;
    default:
      locale = 'en-US';
  }
  
  // Set decimal digit options based on currency
  const minimumFractionDigits = code === 'JPY' ? 0 : 2;
  const maximumFractionDigits = code === 'JPY' ? 0 : 2;
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(numericAmount);
  } catch (error) {
    console.error(`Currency formatting error with code "${code}":`, error);
    // Fallback to simple formatting with the currency symbol as a prefix
    return `$${numericAmount.toFixed(2)}`;
  }
};
import { Loader, Loader2, PlusCircle, Trash2, X, RefreshCw, RotateCw, UserRound, Pencil, Edit, Mail, AlertTriangle } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Schemas for form validation
const organizationSchema = z.object({
  name: z.string().min(2, { message: "Organization name is required" }),
  email: z.string().email({ message: "Valid email is required" }).optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  enableTax: z.boolean().default(true), // Default to enabled
});

const currencySchema = z.object({
  code: z.string().length(3, { message: "Currency code must be exactly 3 characters (e.g., USD)" }),
  name: z.string().min(2, { message: "Currency name is required" }),
  symbol: z.string().min(1, { message: "Currency symbol is required" }),
  isDefault: z.boolean().optional(),
});

const taxRateSchema = z.object({
  countryCode: z.string().length(2, { message: "Country code must be exactly 2 characters (e.g., US)" }),
  regionCode: z.string().optional(),
  name: z.string().min(2, { message: "Tax rate name is required" }),
  rate: z.number().min(0).max(1, { message: "Rate must be between 0 and 1 (e.g., 0.07 for 7%)" }),
  isDefault: z.boolean().optional(),
});

const technicianSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional(),
  role: z.string().min(1, { message: "Role is required" }),
  specialty: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

const emailSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  fromEmail: z.string().email('Please enter a valid email address').min(1, 'From email is required'),
  fromName: z.string().min(1, 'From name is required'),
  replyTo: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  footerText: z.string().optional().or(z.literal('')),
  provider: z.enum(['sendgrid', 'smtp', 'mailgun']).default('sendgrid'),
  
  // SendGrid specific settings
  sendgridApiKey: z.string().optional().or(z.literal('')),
  
  // SMTP specific settings
  smtpHost: z.string().optional().or(z.literal('')),
  smtpPort: z.number().int().positive().optional().or(z.literal('')).transform(v => v === '' ? 587 : Number(v)),
  smtpUser: z.string().optional().or(z.literal('')),
  smtpPassword: z.string().optional().or(z.literal('')),
  smtpSecure: z.boolean().optional().default(false),
  
  // Mailgun specific settings
  mailgunApiKey: z.string().optional().or(z.literal('')),
  mailgunDomain: z.string().optional().or(z.literal('')),
  mailgunRegion: z.enum(['us', 'eu']).default('us')
});

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('organization');
  const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);
  const [showTaxRateDialog, setShowTaxRateDialog] = useState(false);
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false);
  const [showOrganizationDialog, setShowOrganizationDialog] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<any>(null);
  const [editingTaxRate, setEditingTaxRate] = useState<any>(null);
  const [editingTechnician, setEditingTechnician] = useState<any>(null);
  const [editingOrganization, setEditingOrganization] = useState<any>(null);
  const [deletingCurrencyCode, setDeletingCurrencyCode] = useState<string | null>(null);
  const [deletingTaxRateId, setDeletingTaxRateId] = useState<number | null>(null);
  const [deletingTechnicianId, setDeletingTechnicianId] = useState<number | null>(null);
  const [showDeleteAllDataConfirm, setShowDeleteAllDataConfirm] = useState(false);
  const [activeTrashTab, setActiveTrashTab] = useState('customers');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch email settings from the API
  const { data: emailSettingsData, isLoading: isLoadingEmailSettings } = useQuery({
    queryKey: ['/api/settings/email'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: activeTab === 'email'
  });
  
  // Email form setup
  const emailForm = useForm<z.infer<typeof emailSettingsSchema>>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      enabled: true,
      fromEmail: '',
      fromName: '',
      replyTo: '',
      footerText: '',
      provider: 'sendgrid',
      sendgridApiKey: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: false,
      mailgunApiKey: '',
      mailgunDomain: '',
      mailgunRegion: 'us'
    }
  });
  
  // Cache to store provider-specific settings when switching between providers
  const [providerSettings, setProviderSettings] = useState<{
    sendgrid: { sendgridApiKey: string };
    smtp: { 
      smtpHost: string; 
      smtpPort: number; 
      smtpUser: string; 
      smtpPassword: string; 
      smtpSecure: boolean 
    };
    mailgun: { 
      mailgunApiKey: string; 
      mailgunDomain: string; 
      mailgunRegion: 'us' | 'eu' 
    };
  }>({
    sendgrid: {
      sendgridApiKey: ''
    },
    smtp: {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: false
    },
    mailgun: {
      mailgunApiKey: '',
      mailgunDomain: '',
      mailgunRegion: 'us'
    }
  });

  // Update email form when settings are loaded from API
  useEffect(() => {
    if (emailSettingsData && typeof emailSettingsData === 'object') {
      console.log('Updating email form with data from API:', emailSettingsData);
      // Cast to any to avoid TypeScript errors with the API response
      const settings = emailSettingsData as any;
      
      // Log provider value to debug
      console.log('Provider from settings:', settings.provider);
      
      // Update the provider settings cache with any values from the API
      setProviderSettings({
        sendgrid: {
          sendgridApiKey: settings.sendgridApiKey ?? ''
        },
        smtp: {
          smtpHost: settings.smtpHost ?? '',
          smtpPort: settings.smtpPort ?? 587,
          smtpUser: settings.smtpUser ?? '',
          smtpPassword: settings.smtpPassword ?? '',
          smtpSecure: settings.smtpSecure ?? false
        },
        mailgun: {
          mailgunApiKey: settings.mailgunApiKey ?? '',
          mailgunDomain: settings.mailgunDomain ?? '',
          mailgunRegion: (settings.mailgunRegion === 'eu' ? 'eu' : 'us') as 'us' | 'eu'
        }
      });
      
      // Set form values with defaults where needed
      emailForm.reset({
        enabled: settings.enabled ?? true,
        fromEmail: settings.fromEmail ?? '',
        fromName: settings.fromName ?? '',
        replyTo: settings.replyTo ?? '',
        footerText: settings.footerText ?? '',
        provider: settings.provider ?? 'sendgrid',
        
        // Provider-specific settings
        sendgridApiKey: settings.sendgridApiKey ?? '',
        
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort ?? 587,
        smtpUser: settings.smtpUser ?? '',
        smtpPassword: settings.smtpPassword ?? '',
        smtpSecure: settings.smtpSecure ?? false,
        
        // Mailgun specific settings
        mailgunApiKey: settings.mailgunApiKey ?? '',
        mailgunDomain: settings.mailgunDomain ?? '',
        mailgunRegion: settings.mailgunRegion ?? 'us'
      });
      
      // Force update provider field separately to ensure it's set correctly
      if (settings.provider) {
        emailForm.setValue('provider', settings.provider);
        console.log('Explicitly set provider to:', settings.provider);
        
        // Also set the previous provider value to match 
        setPreviousProvider(settings.provider);
        
        // Apply provider-specific settings 
        const currentProvider = settings.provider;
        if (currentProvider === 'sendgrid') {
          console.log('Restored sendgrid settings:', {
            sendgridApiKey: settings.sendgridApiKey ?? ''
          });
        } else if (currentProvider === 'smtp') {
          console.log('Restored smtp settings:', {
            smtpHost: settings.smtpHost ?? '',
            smtpPort: settings.smtpPort ?? 587,
            smtpUser: settings.smtpUser ?? '',
            smtpPassword: settings.smtpPassword ?? '',
            smtpSecure: settings.smtpSecure ?? false
          });
        } else if (currentProvider === 'mailgun') {
          console.log('Restored mailgun settings:', {
            mailgunApiKey: settings.mailgunApiKey ?? '',
            mailgunDomain: settings.mailgunDomain ?? '',
            mailgunRegion: settings.mailgunRegion ?? 'us'
          });
        }
      }
    }
  }, [emailSettingsData, emailForm]);
  
  // Store the previous provider value to track changes
  const [previousProvider, setPreviousProvider] = useState<string | null>(null);
  
  // Watch for provider changes to save/restore provider-specific settings
  useEffect(() => {
    // Function to save the current provider settings to our cache
    const saveCurrentProviderSettings = (provider: string, values: any) => {
      if (provider === 'sendgrid') {
        const sendgridApiKey = values.sendgridApiKey || '';
        setProviderSettings(prev => ({
          ...prev,
          sendgrid: { sendgridApiKey }
        }));
        console.log('Saved sendgrid settings:', { sendgridApiKey });
      } else if (provider === 'smtp') {
        const smtpHost = values.smtpHost || '';
        const smtpPort = values.smtpPort || 587;
        const smtpUser = values.smtpUser || '';
        const smtpPassword = values.smtpPassword || '';
        const smtpSecure = Boolean(values.smtpSecure);
        
        setProviderSettings(prev => ({
          ...prev,
          smtp: { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure }
        }));
        console.log('Saved smtp settings:', { smtpHost, smtpPort, smtpUser, smtpSecure });
      } else if (provider === 'mailgun') {
        const mailgunApiKey = values.mailgunApiKey || '';
        const mailgunDomain = values.mailgunDomain || '';
        // Ensure we're using a valid enum value
        const mailgunRegion = (values.mailgunRegion === 'eu' ? 'eu' : 'us') as 'us' | 'eu';
        
        setProviderSettings(prev => ({
          ...prev,
          mailgun: { mailgunApiKey, mailgunDomain, mailgunRegion }
        }));
        console.log('Saved mailgun settings:', { mailgunApiKey, mailgunDomain, mailgunRegion });
      }
    };
    
    // Function to restore settings for a specific provider
    const restoreProviderSettings = (provider: string) => {
      if (provider === 'sendgrid') {
        const { sendgridApiKey } = providerSettings.sendgrid;
        emailForm.setValue('sendgridApiKey', sendgridApiKey);
        console.log('Restored sendgrid settings:', { sendgridApiKey });
      } else if (provider === 'smtp') {
        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } = providerSettings.smtp;
        emailForm.setValue('smtpHost', smtpHost);
        emailForm.setValue('smtpPort', smtpPort);
        emailForm.setValue('smtpUser', smtpUser);
        emailForm.setValue('smtpPassword', smtpPassword);
        emailForm.setValue('smtpSecure', smtpSecure);
        console.log('Restored smtp settings:', { smtpHost, smtpPort, smtpUser, smtpSecure });
      } else if (provider === 'mailgun') {
        const { mailgunApiKey, mailgunDomain, mailgunRegion } = providerSettings.mailgun;
        emailForm.setValue('mailgunApiKey', mailgunApiKey);
        emailForm.setValue('mailgunDomain', mailgunDomain);
        emailForm.setValue('mailgunRegion', mailgunRegion);
        console.log('Restored mailgun settings:', { mailgunApiKey, mailgunDomain, mailgunRegion });
      }
    };
    
    // Watch for provider changes in the form
    const subscription = emailForm.watch((values, { name }) => {
      if (name === 'provider') {
        const newProvider = values.provider as 'sendgrid' | 'smtp' | 'mailgun';
        console.log('Provider changed to:', newProvider);
        
        // Save settings for the previous provider before changing
        if (previousProvider) {
          saveCurrentProviderSettings(previousProvider, emailForm.getValues());
        }
        
        // Use setTimeout to ensure this runs after the current state update cycle
        setTimeout(() => {
          // Restore settings for the new provider
          restoreProviderSettings(newProvider);
          
          // Update the previous provider for the next change
          setPreviousProvider(newProvider);
        }, 50);
      }
    });
    
    // Initialize previousProvider and settings from loaded data
    if (!previousProvider && emailForm.getValues().provider) {
      const currentProvider = emailForm.getValues().provider;
      setPreviousProvider(currentProvider);
      
      // Save initial settings from the form
      saveCurrentProviderSettings(currentProvider, emailForm.getValues());
    }
    
    // Cleanup the subscription on unmount
    return () => subscription.unsubscribe();
  }, [emailForm, providerSettings, previousProvider]);
  
  // Handle email form submission
  const onEmailFormSubmit = async (data: z.infer<typeof emailSettingsSchema>) => {
    if (!organization) return;
    
    console.log('Submitting email settings form with data:', data);
    
    // Create a simpler object to send to the API - we don't need to merge with existing settings
    // The API will do that for us
    const emailSettings = {
      enabled: data.enabled,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      replyTo: data.replyTo || '',
      footerText: data.footerText || '',
      
      // Provider settings - this is critical to save
      provider: data.provider,
      
      // Include the appropriate provider-specific settings
      ...(data.provider === 'sendgrid' 
          ? { sendgridApiKey: data.sendgridApiKey || '' }
          : data.provider === 'mailgun'
            ? {
                mailgunApiKey: data.mailgunApiKey || '',
                mailgunDomain: data.mailgunDomain || '',
                mailgunRegion: data.mailgunRegion || 'us'
              }
            : {
                smtpHost: data.smtpHost || '',
                smtpPort: typeof data.smtpPort === 'number' ? data.smtpPort : 587,
                smtpUser: data.smtpUser || '',
                smtpPassword: data.smtpPassword || '',
                smtpSecure: data.smtpSecure || false
              }
      )
    };
    
    console.log('Email settings being sent to API:', emailSettings);
    
    // Send only the email settings to be updated
    updateEmailSettingsMutation.mutate(emailSettings);
  };
  
  // Handle sending test email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !emailForm.getValues('enabled')) return;
    
    setIsSendingTestEmail(true);
    
    try {
      const headers = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          to: testEmailAddress,
          emailSettings: emailForm.getValues()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Test email error response:', errorData);
        
        let errorMessage = `Failed to send test email: ${response.status}`;
        let errorDetails = '';
        
        if (errorData.details) {
          errorMessage = errorData.details;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Check for Gmail-specific issues in the error message
        const isGmail = emailForm.getValues('smtpHost')?.includes('gmail.com');
        const lowerErrorMsg = errorMessage.toLowerCase();
        
        if (isGmail) {
          // Add helpful context for Gmail-specific errors
          if (lowerErrorMsg.includes('invalid login') || 
              lowerErrorMsg.includes('auth') || 
              lowerErrorMsg.includes('535') ||
              lowerErrorMsg.includes('credentials')) {
            
            errorDetails = "Note: If you're using Gmail with 2-Step Verification, you need to use an App Password " +
              "instead of your regular password. Go to your Google Account > Security > App Passwords to generate one.";
          }
        }
        
        // Combine the error message with any additional details
        const fullErrorMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage;
        throw new Error(fullErrorMessage);
      }
      
      toast({
        title: 'Test Email Sent',
        description: `A test email has been sent to ${testEmailAddress}`,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      // Convert error message to format that can display line breaks in toast
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const formattedMessage = errorMessage.split('\n\n').map((line, i) => (
        <p key={i} className={i > 0 ? "mt-2 text-sm" : "text-sm"}>{line}</p>
      ));
      
      toast({
        title: 'Failed to Send Email',
        description: (
          <div className="whitespace-pre-line">{formattedMessage}</div>
        ),
        variant: 'destructive'
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };
  
  // Utility for simplified API calls with consistent auth headers
  const apiCall = async (url: string, method: string, data?: any) => {
    try {
      // Get token from firebase_token (main app storage)
      let token = localStorage.getItem('firebase_token') || '';
      if (!token.startsWith('Bearer ')) {
        token = `Bearer ${token}`;
      }
      
      const headers = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json',
        'Authorization': token
      };
      
      console.log(`Making API ${method} request to ${url}`);
      
      const options: RequestInit = {
        method,
        headers,
        credentials: 'include'
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  // Mutation to update email settings
  const updateEmailSettingsMutation = useMutation({
    mutationFn: async (emailSettings: any) => {
      console.log('Email settings mutation called with:', emailSettings);
    
      // Explicitly structure the request to match server expectations
      return apiCall('/api/settings/organization', 'POST', {
        type: 'email',
        settings: emailSettings  // Send the entire emailSettings object directly
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email Settings Updated',
        description: 'Your email configuration has been saved successfully.'
      });
      // Refetch both organization and email settings data
      fetchOrganization();
      queryClient.invalidateQueries({ queryKey: ['/api/settings/email'] });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });
  
  // Define types for our queries
  interface Organization {
    id: number;
    name: string;
    slug: string;
    logo?: string;
    ownerId: string;
    email?: string;
    phone?: string;
    address?: string;
    settings?: Record<string, any>;
  }
  
  interface EmailSettings {
    enabled: boolean;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    footerText?: string;
  }
  
  interface Currency {
    code: string;
    name: string;
    symbol: string;
    isDefault: boolean;
  }
  
  interface TaxRate {
    id: number;
    countryCode: string;
    regionCode: string | null;
    name: string;
    rate: number;
    isDefault: boolean;
  }
  
  // Define interfaces for deleted records
  interface Customer {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    notes: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Device {
    id: number;
    customerId: number;
    type: string;
    brand: string;
    model: string;
    serialNumber: string | null;
    password: string | null;
    condition: string | null;
    accessories: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Repair {
    id: number;
    ticketNumber: string;
    customerId: number;
    deviceId: number | null;
    technicianId: number | null;
    status: string;
    issue: string;
    notes: string | null;
    intakeDate: string;
    estimatedCompletionDate: string | null;
    actualCompletionDate: string | null;
    priorityLevel: number | null;
    isUnderWarranty: boolean | null;
    diagnosticNotes: string | null;
    customerApproval: boolean | null;
    totalCost: number | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Technician {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    specialty: string | null;
    isActive: boolean | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface InventoryItem {
    id: number;
    name: string;
    description: string | null;
    category: string;
    sku: string | null;
    price: number;
    cost: number | null;
    quantity: number | null;
    location: string | null;
    supplier: string | null;
    minLevel: number | null;
    isActive: boolean | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Quote {
    id: number;
    repairId: number;
    quoteNumber: string;
    subtotal: number;
    tax: number | null;
    total: number;
    status: string | null;
    customerNotes: string | null;
    internalNotes: string | null;
    validUntil: string | null;
    termsAndConditions: string | null;
    itemsData: string | null; 
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Invoice {
    id: number;
    repairId: number;
    invoiceNumber: string;
    subtotal: number;
    tax: number | null;
    total: number;
    status: string | null;
    customerNotes: string | null;
    internalNotes: string | null;
    dueDate: string | null;
    itemsData: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }

  // Queries
  // Manual fetch for organization with proper headers
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [organizationError, setOrganizationError] = useState<Error | null>(null);
  
  // Helper function to get current organization ID
  const getCurrentOrgId = useCallback(() => {
    return organization?.id || Number(localStorage.getItem('currentOrganizationId')) || 3;
  }, [organization]);
  
  // Helper function to get standard request headers with current organization ID
  const getStandardHeaders = useCallback((authToken?: string | null) => {
    const orgId = getCurrentOrgId();
    
    const headers: Record<string, string> = {
      'X-Debug-Client': 'RepairTrackerClient',
      'X-Organization-ID': orgId.toString(),
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    };
    
    // Add authorization header if token exists
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return headers;
  }, [getCurrentOrgId]);

  // Function to fetch organization with proper headers
  const fetchOrganization = async () => {
    setIsLoadingOrganization(true);
    try {
      // Get the auth token 
      const authToken = getAuthToken();
      
      const orgId = getCurrentOrgId();
      
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': orgId.toString(), // Use dynamic organization ID
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Adding auth token to organization fetch request');
      } else {
        console.warn('No authentication token found for organization fetch');
      }
      
      console.log('SETTINGS DEBUG: Fetching organization with headers:', headers);
      const response = await fetch('/api/organizations', { 
        headers,
        credentials: 'include' // Include auth cookies
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching organization: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Organization loaded successfully:', data);
      
      // Get the first organization if it's an array
      const firstOrg = Array.isArray(data) && data.length > 0 ? data[0] : null;
      setOrganization(firstOrg);
    } catch (error) {
      console.error('❌ Error loading organization:', error);
      setOrganizationError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingOrganization(false);
    }
  };

  // Fetch organization on component mount
  useEffect(() => {
    fetchOrganization();
  }, []);
  
  // Manual fetch with proper organization header for currencies
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [currenciesError, setCurrenciesError] = useState<Error | null>(null);

  // Function to fetch currencies with organization headers
  const fetchCurrencies = async () => {
    setIsLoadingCurrencies(true);
    try {
      // Get standardized headers with organization ID
      const headers = getStandardHeaders();
      
      console.log('SETTINGS DEBUG: Fetching currencies with headers:', headers);
      const response = await fetch('/api/settings/currencies', { headers });
      
      if (!response.ok) {
        throw new Error(`Error fetching currencies: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Currencies loaded successfully:', data);
      setCurrencies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error loading currencies:', error);
      setCurrenciesError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingCurrencies(false);
    }
  };

  // Fetch currencies on component mount
  useEffect(() => {
    fetchCurrencies();
  }, []);
  
  // Manual fetch with proper organization header for tax rates
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoadingTaxRates, setIsLoadingTaxRates] = useState(true);
  const [taxRatesError, setTaxRatesError] = useState<Error | null>(null);

  // Function to fetch tax rates with organization headers
  const fetchTaxRates = async () => {
    setIsLoadingTaxRates(true);
    try {
      // Get standardized headers with organization ID
      const headers = getStandardHeaders();
      
      console.log('SETTINGS DEBUG: Fetching tax rates with headers:', headers);
      const response = await fetch('/api/settings/tax-rates', { headers });
      
      if (!response.ok) {
        throw new Error(`Error fetching tax rates: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Tax rates loaded successfully:', data);
      setTaxRates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error loading tax rates:', error);
      setTaxRatesError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingTaxRates(false);
    }
  };

  // Fetch tax rates on component mount
  useEffect(() => {
    fetchTaxRates();
  }, []);
  
  // Manual fetch with proper organization header for technicians
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(true);
  const [techniciansError, setTechniciansError] = useState<Error | null>(null);

  // Function to fetch technicians with organization headers
  const fetchTechnicians = async () => {
    setIsLoadingTechnicians(true);
    try {
      const headers = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      };
      
      console.log('SETTINGS DEBUG: Fetching technicians with headers:', headers);
      const response = await fetch('/api/technicians', { headers });
      
      if (!response.ok) {
        throw new Error(`Error fetching technicians: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Technicians loaded successfully:', data);
      setTechnicians(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error loading technicians:', error);
      setTechniciansError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingTechnicians(false);
    }
  };

  // Fetch technicians when the tab changes to technicians
  useEffect(() => {
    if (activeTab === 'technicians') {
      fetchTechnicians();
    }
  }, [activeTab]);
  
  // Trash management queries
  const {
    data: deletedCustomers = [],
    isLoading: isLoadingDeletedCustomers,
  } = useQuery<Customer[]>({
    queryKey: ['/api/trash/customers'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'customers',
  });
  
  const {
    data: deletedDevices = [],
    isLoading: isLoadingDeletedDevices,
  } = useQuery<Device[]>({
    queryKey: ['/api/trash/devices'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'devices',
  });
  
  const {
    data: deletedRepairs = [],
    isLoading: isLoadingDeletedRepairs,
  } = useQuery<Repair[]>({
    queryKey: ['/api/trash/repairs'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'repairs',
  });
  
  const {
    data: deletedTechnicians = [],
    isLoading: isLoadingDeletedTechnicians,
  } = useQuery<Technician[]>({
    queryKey: ['/api/trash/technicians'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'technicians',
  });
  
  const {
    data: deletedInventoryItems = [],
    isLoading: isLoadingDeletedInventoryItems,
  } = useQuery<InventoryItem[]>({
    queryKey: ['/api/trash/inventory'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'inventory',
  });
  
  const {
    data: deletedQuotes = [],
    isLoading: isLoadingDeletedQuotes,
  } = useQuery<Quote[]>({
    queryKey: ['/api/trash/quotes'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'quotes',
  });
  
  const {
    data: deletedInvoices = [],
    isLoading: isLoadingDeletedInvoices,
  } = useQuery<Invoice[]>({
    queryKey: ['/api/trash/invoices'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'invoices',
  });
  
  // Currency form
  const currencyForm = useForm<z.infer<typeof currencySchema>>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
      isDefault: false,
    }
  });
  
  // Tax rate form
  const taxRateForm = useForm<z.infer<typeof taxRateSchema>>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: {
      countryCode: '',
      regionCode: '',
      name: '',
      rate: 0,
      isDefault: false,
    }
  });
  
  // Technician form
  const technicianForm = useForm<z.infer<typeof technicianSchema>>({
    resolver: zodResolver(technicianSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: '',
      specialty: '',
      isActive: true,
    }
  });
  
  // Form for organization
  const organizationForm = useForm<z.infer<typeof organizationSchema>>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      enableTax: true, // Default to enabled
    }
  });

  // Update form when organization data is loaded
  useEffect(() => {
    if (organization) {
      console.log('Resetting organization form with data:', organization);
      // Default to enabled if not explicitly set to false
      const enableTax = organization.settings?.enableTax !== false;
      
      // Get email value from settings, handling different formats
      let emailValue = '';
      const emailSetting = organization.settings?.email;
      
      if (emailSetting) {
        if (typeof emailSetting === 'string') {
          emailValue = emailSetting;
        } else if (typeof emailSetting === 'object') {
          // Check if it's an array-like object with numeric keys
          if (Object.keys(emailSetting).every(key => !isNaN(Number(key)))) {
            emailValue = Object.values(emailSetting).join('');
          } 
          // Check if it's an email settings object with fromEmail property
          else if ('fromEmail' in emailSetting) {
            emailValue = emailSetting.fromEmail;
          }
        }
      }
      
      organizationForm.reset({
        name: organization.name || '',
        email: emailValue,
        phone: (organization.settings?.phone as string) || '',
        address: (organization.settings?.address as string) || '',
        enableTax: enableTax,
      });
      
      // Also populate email settings form
      let emailSettings = {};
      
      // Check if email settings is an object with numeric keys (array-like object)
      if (organization.settings?.email && typeof organization.settings.email === 'object') {
        // Check if it's an array-like object with numeric keys (malformed email)
        if (Object.keys(organization.settings.email).every(key => !isNaN(Number(key)))) {
          const emailString = Object.values(organization.settings.email).join('');
          console.log('Converting array-like email to string:', emailString);
          
          // Create proper email settings object
          emailSettings = {
            enabled: true,
            provider: 'sendgrid',
            fromEmail: emailString,
            fromName: organization.name || '',
          };
        } else {
          // It's already a proper object
          emailSettings = organization.settings.email;
        }
      } else if (typeof organization.settings?.email === 'string') {
        // If it's just a string, create a proper object
        emailSettings = {
          enabled: true,
          provider: 'sendgrid',
          fromEmail: organization.settings.email,
          fromName: organization.name || '',
        };
      }
      
      console.log('Setting email form with data:', emailSettings);
      
      // Set default email form values using the email settings object
      emailForm.reset({
        // Basic email settings
        enabled: (emailSettings as any).enabled !== false, // Default to true
        fromEmail: (emailSettings as any).fromEmail || '',
        fromName: (emailSettings as any).fromName || organization.name || '',
        replyTo: (emailSettings as any).replyTo || '',
        footerText: (emailSettings as any).footerText || `© ${new Date().getFullYear()} ${organization.name}`,
        
        // Provider selection
        provider: (emailSettings as any).provider || 'sendgrid',
        
        // SendGrid settings
        sendgridApiKey: (emailSettings as any).sendgridApiKey || '',
        
        // SMTP settings
        smtpHost: (emailSettings as any).smtpHost || '',
        smtpPort: (emailSettings as any).smtpPort || 587,
        smtpUser: (emailSettings as any).smtpUser || '',
        smtpPassword: (emailSettings as any).smtpPassword || '',
        smtpSecure: (emailSettings as any).smtpSecure === true
      });
    }
  }, [organization, emailForm]);

  // Mutations
  const updateOrganizationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof organizationSchema>) => {
      console.log('Submitting organization update:', data);
      
      // Get the auth token
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Adding auth token to organization update request');
      } else {
        console.warn('No authentication token found, organization update may fail');
      }
      
      const response = await fetch('/api/settings/organization', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          type: 'company'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error updating organization: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch organization data directly
      fetchOrganization();
      setShowOrganizationDialog(false);
      toast({
        title: "Organization updated",
        description: "Your organization information has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating organization",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const createCurrencyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof currencySchema>) => {
      console.log('Creating currency:', data);
      
      const headers = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('/api/settings/currencies', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Error creating currency: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch currency data directly
      fetchCurrencies();
      setShowCurrencyDialog(false);
      currencyForm.reset();
      toast({
        title: "Currency added",
        description: "The currency has been successfully added",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const updateCurrencyMutation = useMutation({
    mutationFn: (data: z.infer<typeof currencySchema>) => 
      apiRequest('PUT', `/api/settings/currencies/${data.code}`, {
        name: data.name,
        symbol: data.symbol,
        isDefault: data.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      setShowCurrencyDialog(false);
      setEditingCurrency(null);
      currencyForm.reset();
      toast({
        title: "Currency updated",
        description: "The currency has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const deleteCurrencyMutation = useMutation({
    mutationFn: (code: string) => 
      apiRequest('DELETE', `/api/settings/currencies/${code}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      setDeletingCurrencyCode(null);
      toast({
        title: "Currency deleted",
        description: "The currency has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const createTaxRateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof taxRateSchema>) => {
      console.log('Creating tax rate:', data);
      
      // Get the auth token
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Adding auth token to create tax rate request');
      } else {
        console.warn('No authentication token found for creating tax rate');
      }
      
      const response = await fetch('/api/settings/tax-rates', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Error creating tax rate: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch data directly
      fetchTaxRates();
      setShowTaxRateDialog(false);
      taxRateForm.reset();
      toast({
        title: "Tax rate added",
        description: "The tax rate has been successfully added",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const updateTaxRateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Updating tax rate:', data);
      
      // Get the auth token
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Adding auth token to tax rate update request');
      } else {
        console.warn('No authentication token found for tax rate update');
      }
      
      const response = await fetch(`/api/settings/tax-rates/${data.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          countryCode: data.countryCode,
          regionCode: data.regionCode,
          name: data.name,
          rate: data.rate,
          isDefault: data.isDefault,
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error updating tax rate: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Directly refetch data instead of only invalidating queries
      fetchTaxRates();
      
      setShowTaxRateDialog(false);
      setEditingTaxRate(null);
      taxRateForm.reset();
      toast({
        title: "Tax rate updated",
        description: "The tax rate has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const deleteTaxRateMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/settings/tax-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tax-rates'] });
      setDeletingTaxRateId(null);
      toast({
        title: "Tax rate deleted",
        description: "The tax rate has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  // Technician mutations
  const createTechnicianMutation = useMutation({
    mutationFn: async (data: z.infer<typeof technicianSchema>) => {
      console.log('Creating technician:', data);
      
      const headers = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2', // Hardcoded ID for now
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('/api/technicians', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Error creating technician: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch data directly
      fetchTechnicians();
      setShowTechnicianDialog(false);
      technicianForm.reset();
      toast({
        title: "Technician added",
        description: "The technician has been successfully added",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding technician",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const updateTechnicianMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('PUT', `/api/technicians/${data.id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        specialty: data.specialty,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technicians'] });
      setShowTechnicianDialog(false);
      setEditingTechnician(null);
      technicianForm.reset();
      toast({
        title: "Technician updated",
        description: "The technician has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating technician",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const deleteTechnicianMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/technicians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technicians'] });
      setDeletingTechnicianId(null);
      toast({
        title: "Technician deleted",
        description: "The technician has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting technician",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  // Restore mutations for deleted records
  const restoreCustomerMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/customers/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Customer restored",
        description: `${data.firstName} ${data.lastName} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring customer",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreDeviceMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/devices/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Device restored",
        description: `${data.brand} ${data.model} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring device",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreRepairMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/repairs/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/repairs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Repair restored",
        description: `Repair ticket ${data.ticketNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring repair",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreTechnicianMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/technicians/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/technicians'] });
      queryClient.invalidateQueries({ queryKey: ['/api/technicians'] });
      toast({
        title: "Technician restored",
        description: `${data.firstName} ${data.lastName} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring technician",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreInventoryItemMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/inventory/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({
        title: "Inventory item restored",
        description: `${data.name} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring inventory item",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreQuoteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/quotes/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({
        title: "Quote restored",
        description: `Quote ${data.quoteNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring quote",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreInvoiceMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/invoices/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Invoice restored",
        description: `Invoice ${data.invoiceNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring invoice",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  // Event handlers
  const handleUpdateOrganization = (data: z.infer<typeof organizationSchema>) => {
    updateOrganizationMutation.mutate(data);
  };
  
  const handleAddCurrency = (data: z.infer<typeof currencySchema>) => {
    if (editingCurrency) {
      updateCurrencyMutation.mutate(data);
    } else {
      createCurrencyMutation.mutate(data);
    }
  };
  
  const handleAddTaxRate = (data: z.infer<typeof taxRateSchema>) => {
    if (editingTaxRate) {
      updateTaxRateMutation.mutate({
        ...data,
        id: editingTaxRate.id,
      });
    } else {
      createTaxRateMutation.mutate(data);
    }
  };
  
  const handleEditCurrency = (currency: any) => {
    setEditingCurrency(currency);
    currencyForm.reset({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isDefault: currency.isDefault,
    });
    setShowCurrencyDialog(true);
  };
  
  // Handle setting a currency as default
  const handleSetDefaultCurrency = async (currencyCode: string) => {
    try {
      // Get the auth token
      const authToken = getAuthToken();
      
      // Get current organization ID from the state or localStorage
      const orgId = organization?.id || Number(localStorage.getItem('currentOrganizationId')) || 3;
      
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': orgId.toString(), // Use the current organization ID
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Adding auth token to currency default update request');
      } else {
        console.warn('No authentication token found for currency update');
      }
      
      console.log(`Setting currency ${currencyCode} as default`);
      
      const response = await fetch(`/api/settings/currencies/${currencyCode}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ isDefault: true })
      });
      
      if (!response.ok) {
        throw new Error(`Error setting default currency: ${response.status}`);
      }
      
      // Clear all cached data by forcing a hard reset of the React Query cache for currency data
      queryClient.removeQueries({ queryKey: ['/api/settings/currencies'] });
      queryClient.removeQueries({ queryKey: ['/api/settings/currencies/default'] });
      
      // Refetch all data with a slight delay to ensure database updates have propagated
      setTimeout(() => {
        // Force refetch to get fresh data after the changes have been applied
        fetchCurrencies();
        
        // Only invalidate currency-related queries for a more selective cache clear
        queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
        queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies/default'] });
        
        // Show a toast notification with improved message (no longer mentions cache reset)
        toast({
          title: "Default currency updated",
          description: `The default currency has been set to ${currencyCode}.`
        });
      }, 300);
    } catch (error) {
      console.error('Error setting default currency:', error);
      toast({
        title: "Error setting default currency",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };
  
  const handleEditTaxRate = (taxRate: any) => {
    setEditingTaxRate(taxRate);
    taxRateForm.reset({
      countryCode: taxRate.countryCode,
      regionCode: taxRate.regionCode || '',
      name: taxRate.name,
      rate: taxRate.rate,
      isDefault: taxRate.isDefault,
    });
    setShowTaxRateDialog(true);
  };
  
  const handleDeleteCurrency = (code: string) => {
    setDeletingCurrencyCode(code);
  };
  
  const handleDeleteTaxRate = (id: number) => {
    setDeletingTaxRateId(id);
  };
  
  const handleCloseCurrencyDialog = () => {
    setShowCurrencyDialog(false);
    setEditingCurrency(null);
    currencyForm.reset();
  };
  
  const handleCloseTaxRateDialog = () => {
    setShowTaxRateDialog(false);
    setEditingTaxRate(null);
    taxRateForm.reset();
  };
  
  // Restore handlers for deleted records
  const handleRestoreCustomer = (id: number) => {
    restoreCustomerMutation.mutate(id);
  };
  
  const handleRestoreDevice = (id: number) => {
    restoreDeviceMutation.mutate(id);
  };
  
  const handleRestoreRepair = (id: number) => {
    restoreRepairMutation.mutate(id);
  };
  
  const handleRestoreTechnician = (id: number) => {
    restoreTechnicianMutation.mutate(id);
  };
  
  const handleRestoreInventoryItem = (id: number) => {
    restoreInventoryItemMutation.mutate(id);
  };
  
  const handleRestoreQuote = (id: number) => {
    restoreQuoteMutation.mutate(id);
  };
  
  const handleRestoreInvoice = (id: number) => {
    restoreInvoiceMutation.mutate(id);
  };
  
  return (
    <div className="container mx-auto pt-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure application settings</p>
      </div>
      
      <Tabs defaultValue="organization" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="currencies">
            Currencies
          </TabsTrigger>
          <TabsTrigger value="tax-rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="data-management">Data Management</TabsTrigger>
        </TabsList>
        
        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>
                  Manage your organization information
                </CardDescription>
              </div>
              <Dialog open={showOrganizationDialog} onOpenChange={setShowOrganizationDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    if (organization) {
                      console.log('Organization data:', organization);
                      
                      // Get settings data with fallbacks to empty strings
                      const settings = organization.settings || {};
                      const email = settings.email || '';
                      const phone = settings.phone || '';
                      const address = settings.address || '';
                      // Default to enabled if the setting isn't explicitly set to false
                      const enableTax = settings.enableTax !== false;
                      
                      console.log('Settings data extracted:', { email, phone, address, enableTax });
                      
                      organizationForm.reset({
                        name: organization.name || '',
                        email: email,
                        phone: phone,
                        address: address,
                        enableTax: enableTax,
                      });
                    }
                  }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Organization
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                    <DialogDescription>
                      Update your organization information below
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...organizationForm}>
                    <form onSubmit={organizationForm.handleSubmit(handleUpdateOrganization)} className="space-y-4">
                      <FormField
                        control={organizationForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your Repair Shop Name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={organizationForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Email</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="contact@yourcompany.com" />
                            </FormControl>
                            <FormDescription>
                              This email will be used on invoices and customer communications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={organizationForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Phone</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="(555) 123-4567" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={organizationForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Address</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="123 Main St, Anytown, ST 12345" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={organizationForm.control}
                        name="enableTax"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Enable Tax Calculations</FormLabel>
                              <FormDescription>
                                Toggle off if your business is not VAT/tax registered
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={updateOrganizationMutation.isPending}>
                          {updateOrganizationMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingOrganization ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : organization ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Organization Name</h3>
                      <p className="text-base">{organization.name}</p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Email</h3>
                      <p className="text-base">
                        {(() => {
                          const email = organization.settings?.email;
                          if (!email || email === "null") return "No email set";
                          
                          // Handle array-like object with numeric keys
                          if (typeof email === 'object' && !Array.isArray(email) && 
                              Object.keys(email).every(key => !isNaN(Number(key)))) {
                            return Object.values(email).join('');
                          }
                          
                          // Handle standard objects with fromEmail property
                          if (typeof email === 'object' && 'fromEmail' in email) {
                            return email.fromEmail;
                          }
                          
                          // Handle case where it's a simple string
                          return typeof email === 'string' ? email : "No email set";
                        })()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                      <p className="text-base">
                        {(organization.settings?.phone && organization.settings.phone !== "null") ? organization.settings.phone : "No phone set"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Address</h3>
                      <p className="text-base">
                        {(organization.settings?.address && organization.settings.address !== "null") ? organization.settings.address : "No address set"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Tax Status</h3>
                      <div className="flex items-center">
                        {organization.settings?.enableTax !== false ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Tax Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Tax Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-gray-500">No organization information found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Email Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure email settings for quotes, invoices, and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrganization ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : organization ? (
                <div className="space-y-6">
                  {(!emailForm.watch('provider') || 
                    (emailForm.watch('provider') === 'sendgrid' && !emailForm.watch('sendgridApiKey')) || 
                    (emailForm.watch('provider') === 'mailgun' && (!emailForm.watch('mailgunApiKey') || !emailForm.watch('mailgunDomain'))) || 
                    (emailForm.watch('provider') === 'smtp' && (!emailForm.watch('smtpHost') || !emailForm.watch('smtpPort')))) && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-800">Default Email Configuration Active</AlertTitle>
                      <AlertDescription className="text-yellow-700">
                        <p className="mb-2">You haven't configured a valid email provider yet. The system will use a default Mailgun account for sending emails to ensure functionality.</p>
                        <p className="mb-2">This is fine for testing, but for production we recommend setting up your own email provider for better deliverability and control.</p>
                        <p>All emails sent using the default configuration will include a notice to recipients.</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailFormSubmit)} className="space-y-4">
                      <FormField
                        control={emailForm.control}
                        name="enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Email Notifications
                              </FormLabel>
                              <FormDescription>
                                Enable sending emails to customers
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={emailForm.control}
                          name="fromEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Email Address</FormLabel>
                              <FormControl>
                                <Input placeholder="service@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                The email address that will appear in the "From" field
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={emailForm.control}
                          name="fromName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your Company Name" {...field} />
                              </FormControl>
                              <FormDescription>
                                The name that will appear in the "From" field
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={emailForm.control}
                        name="replyTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reply-To Email (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="support@example.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              Where customers should reply (defaults to From Email if not specified)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="footerText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Footer (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="© 2025 Your Company Name"
                                className="min-h-[80px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Text to be displayed at the bottom of all emails
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="border p-4 rounded-lg space-y-4">
                        <h3 className="text-lg font-medium">Email Provider Settings</h3>
                        
                        <FormField
                          control={emailForm.control}
                          name="provider"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Provider</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select email provider" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="sendgrid">SendGrid API</SelectItem>
                                  <SelectItem value="smtp">SMTP Server</SelectItem>
                                  <SelectItem value="mailgun">Mailgun API</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose how you want to send emails
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {emailForm.watch('provider') === 'sendgrid' && (
                          <div className="space-y-4 border-t pt-4">
                            <h4 className="font-medium">SendGrid Settings</h4>
                            
                            <FormField
                              control={emailForm.control}
                              name="sendgridApiKey"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SendGrid API Key</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="password" 
                                      placeholder="SG.xxxxxxxxxxxxxxxxxxxx"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Leave blank to use system-wide SendGrid API key
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        
                        {emailForm.watch('provider') === 'mailgun' && (
                          <div className="space-y-4 border-t pt-4">
                            <h4 className="font-medium">Mailgun Settings</h4>
                            
                            <FormField
                              control={emailForm.control}
                              name="mailgunApiKey"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mailgun API Key</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="password" 
                                      placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={emailForm.control}
                              name="mailgunDomain"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mailgun Domain</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="mg.yourdomain.com"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    The domain you've verified with Mailgun
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={emailForm.control}
                              name="mailgunRegion"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mailgun Region</FormLabel>
                                  <Select
                                    onValueChange={field.onChange} 
                                    defaultValue={field.value}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select region" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="us">US (Default)</SelectItem>
                                      <SelectItem value="eu">EU</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose the region where your Mailgun domain is hosted
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        
                        {emailForm.watch('provider') === 'smtp' && (
                          <div className="space-y-4 border-t pt-4">
                            <h4 className="font-medium">SMTP Server Settings</h4>
                            
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormField
                                control={emailForm.control}
                                name="smtpHost"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SMTP Host</FormLabel>
                                    <FormControl>
                                      <Input placeholder="smtp.example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={emailForm.control}
                                name="smtpPort"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SMTP Port</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        placeholder="587" 
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Common ports: 25, 465, 587
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormField
                                control={emailForm.control}
                                name="smtpUser"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SMTP Username</FormLabel>
                                    <FormControl>
                                      <Input placeholder="username@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={emailForm.control}
                                name="smtpPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SMTP Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="●●●●●●●●" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <FormField
                              control={emailForm.control}
                              name="smtpSecure"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Use SSL/TLS
                                    </FormLabel>
                                    <FormDescription>
                                      Enable secure connection (usually for port 465)
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between">
                        <Button type="submit" disabled={updateEmailSettingsMutation.isPending}>
                          {updateEmailSettingsMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Email Settings
                        </Button>
                        
                        <div className="flex gap-2 items-center">
                          <Input
                            type="email"
                            placeholder="Test email address"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            className="max-w-[220px]"
                          />
                          <Button 
                            type="button" 
                            variant="outline"
                            disabled={!testEmailAddress || isSendingTestEmail || !emailForm.getValues("enabled")}
                            onClick={handleSendTestEmail}
                          >
                            {isSendingTestEmail ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="mr-2 h-4 w-4" />
                            )}
                            Send Test Email
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                  
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertTitle>Email Provider Setup</AlertTitle>
                    <AlertDescription>
                      {emailForm.watch('provider') === 'smtp' ? (
                        <>
                          <p className="mb-2">
                            Emails are sent through your custom SMTP server. Make sure to provide valid SMTP credentials for your mail server.
                          </p>
                          
                          {emailForm.watch('smtpHost') === 'smtp.gmail.com' && (
                            <div className="mt-2 border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded text-sm">
                              <h5 className="font-semibold text-blue-800">Gmail-specific instructions:</h5>
                              <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>If you have 2FA enabled on your Google account (recommended), you must generate an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google App Passwords</a></li>
                                <li>Use that App Password instead of your normal Gmail password</li>
                                <li>Make sure the SMTP username matches the Gmail address you're authenticating with</li>
                                <li>Keep port 587 and TLS/SSL enabled</li>
                              </ul>
                            </div>
                          )}
                        </>
                      ) : emailForm.watch('provider') === 'mailgun' ? (
                        <>
                          <p className="mb-2">
                            Emails are sent through Mailgun API. You need to provide your Mailgun API key, domain, and select the correct region where your Mailgun account is hosted.
                          </p>
                          
                          <div className="mt-2 border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded text-sm">
                            <h5 className="font-semibold text-blue-800">Mailgun configuration notes:</h5>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                              <li>Find your API key in the Mailgun dashboard under API Keys</li>
                              <li>Private API keys typically begin with "key-" (older format) or include hyphens</li>
                              <li>Make sure to use a domain that has been verified in your Mailgun account</li>
                              <li>Select the correct region (US or EU) where your Mailgun account is hosted</li>
                              <li>The "From Email" should use a domain that's verified in Mailgun</li>
                            </ul>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mb-2">
                            Emails are sent through SendGrid API. You need to provide a valid SendGrid API key with permissions to send emails.
                          </p>
                          
                          <div className="mt-2 border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded text-sm">
                            <h5 className="font-semibold text-blue-800">SendGrid API Key instructions:</h5>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                              <li>Create an API key at <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">SendGrid API Keys</a></li>
                              <li>Ensure the API key has "Mail Send" permissions</li>
                              <li>Verify your sending domain in SendGrid settings</li>
                              <li>Make sure the "From Email" matches a verified sender in your SendGrid account</li>
                              <li>API keys should begin with "SG." followed by alphanumeric characters</li>
                            </ul>
                          </div>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-gray-500">No organization information found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Currencies Tab */}
        <TabsContent value="currencies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Currencies</CardTitle>
                <CardDescription>
                  Manage currencies for quotes and invoices
                </CardDescription>
                {currencies && currencies.find(c => c.isDefault) && (
                  <div className="flex items-center mt-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Default: {currencies.find(c => c.isDefault)?.code}
                    </Badge>
                  </div>
                )}
              </div>
              <Dialog open={showCurrencyDialog} onOpenChange={setShowCurrencyDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingCurrency(null);
                    currencyForm.reset({
                      code: '',
                      name: '',
                      symbol: '',
                      isDefault: false,
                    });
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Currency
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCurrency ? 'Edit Currency' : 'Add Currency'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCurrency
                        ? 'Update the currency details below'
                        : 'Enter currency details to add a new currency'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...currencyForm}>
                    <form onSubmit={currencyForm.handleSubmit(handleAddCurrency)} className="space-y-4">
                      <FormField
                        control={currencyForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency Code (3 letters)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="USD"
                                maxLength={3}
                                disabled={!!editingCurrency}
                              />
                            </FormControl>
                            <FormDescription>
                              ISO currency code (e.g., USD, EUR, GBP)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="US Dollar" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="symbol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Symbol</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="$" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Set as Default</FormLabel>
                              <FormDescription>
                                Make this the default currency system-wide
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCloseCurrencyDialog}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={
                            createCurrencyMutation.isPending || 
                            updateCurrencyMutation.isPending
                          }
                        >
                          {(createCurrencyMutation.isPending || updateCurrencyMutation.isPending) && (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingCurrency ? 'Update' : 'Add'} Currency
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Currency Preview Section */}
              {currencies && currencies.find(c => c.isDefault) && (
                <div className="mb-6 p-4 border rounded-md bg-slate-50">
                  <h3 className="text-sm font-semibold mb-2">Currency Preview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Small Amount:</p>
                      <p className="text-base font-medium">{formatCurrencyPreview(9.99, currencies.find(c => c.isDefault)?.code || 'USD')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Large Amount:</p>
                      <p className="text-base font-medium">{formatCurrencyPreview(1250.50, currencies.find(c => c.isDefault)?.code || 'USD')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Whole Number:</p>
                      <p className="text-base font-medium">{formatCurrencyPreview(42, currencies.find(c => c.isDefault)?.code || 'USD')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Large Number:</p>
                      <p className="text-base font-medium">{formatCurrencyPreview(9999999.99, currencies.find(c => c.isDefault)?.code || 'USD')}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {isLoadingCurrencies ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : currencies && currencies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency: any) => (
                      <TableRow key={currency.code}>
                        <TableCell className="font-medium">
                          {currency.isCore && currency.code.includes('_CORE') 
                            ? currency.code.split('_')[0]  /* Display just the standard code (USD, EUR, etc.) */
                            : currency.code
                          }
                          {currency.isCore && (
                            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                              Core
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell>{currency.symbol}</TableCell>
                        <TableCell>
                          {currency.isDefault && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {!currency.isDefault && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetDefaultCurrency(currency.code)}
                                className="text-blue-500 border-blue-500 hover:bg-blue-50"
                              >
                                Set Default
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCurrency(currency)}
                            >
                              Edit
                            </Button>
                            <AlertDialog 
                              open={deletingCurrencyCode === currency.code}
                              onOpenChange={(open) => {
                                if (!open) setDeletingCurrencyCode(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteCurrency(currency.code)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Currency</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this currency? This action cannot be undone.
                                    <br /><br />
                                    <strong>Note:</strong> You cannot delete a currency that is in use by quotes or invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCurrencyMutation.mutate(currency.code)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deleteCurrencyMutation.isPending && (
                                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No currencies found. Add one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tax Rates Tab */}
        <TabsContent value="tax-rates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tax Rates</CardTitle>
                <CardDescription>
                  Manage tax rates for different regions
                </CardDescription>
              </div>
              <Dialog open={showTaxRateDialog} onOpenChange={setShowTaxRateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTaxRate(null);
                    taxRateForm.reset({
                      countryCode: '',
                      regionCode: '',
                      name: '',
                      rate: 0,
                      isDefault: false,
                    });
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Tax Rate
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTaxRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTaxRate
                        ? 'Update the tax rate details below'
                        : 'Enter tax rate details to add a new tax rate'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...taxRateForm}>
                    <form onSubmit={taxRateForm.handleSubmit(handleAddTaxRate)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={taxRateForm.control}
                          name="countryCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="US" maxLength={2} />
                              </FormControl>
                              <FormDescription>
                                ISO country code (e.g., US, GB)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={taxRateForm.control}
                          name="regionCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Region Code (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="CA" />
                              </FormControl>
                              <FormDescription>
                                State/province code
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={taxRateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Rate Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sales Tax" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={taxRateForm.control}
                        name="rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate (Decimal)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                placeholder="0.07"
                              />
                            </FormControl>
                            <FormDescription>
                              Enter as decimal (e.g., 0.07 for 7%)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={taxRateForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Set as Default</FormLabel>
                              <FormDescription>
                                Make this the default tax rate system-wide
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCloseTaxRateDialog}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={
                            createTaxRateMutation.isPending || 
                            updateTaxRateMutation.isPending
                          }
                        >
                          {(createTaxRateMutation.isPending || updateTaxRateMutation.isPending) && (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingTaxRate ? 'Update' : 'Add'} Tax Rate
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingTaxRates ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : taxRates && taxRates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates.map((taxRate: any) => (
                      <TableRow key={taxRate.id}>
                        <TableCell>{taxRate.countryCode}</TableCell>
                        <TableCell>{taxRate.regionCode || '-'}</TableCell>
                        <TableCell>{taxRate.name}</TableCell>
                        <TableCell>{(taxRate.rate * 100).toFixed(2)}%</TableCell>
                        <TableCell>
                          {taxRate.isDefault && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTaxRate(taxRate)}
                            >
                              Edit
                            </Button>
                            <AlertDialog 
                              open={deletingTaxRateId === taxRate.id}
                              onOpenChange={(open) => {
                                if (!open) setDeletingTaxRateId(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteTaxRate(taxRate.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Tax Rate</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this tax rate? This action cannot be undone.
                                    <br /><br />
                                    <strong>Note:</strong> You cannot delete a tax rate that is in use by quotes or invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTaxRateMutation.mutate(taxRate.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deleteTaxRateMutation.isPending && (
                                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No tax rates found. Add one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Technicians Tab */}
        <TabsContent value="technicians">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Technicians</CardTitle>
                <CardDescription>
                  Manage technicians and repair specialists
                </CardDescription>
              </div>
              <Dialog open={showTechnicianDialog} onOpenChange={setShowTechnicianDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTechnician(null);
                    technicianForm.reset({
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      role: '',
                      specialty: '',
                      isActive: true,
                    });
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Technician
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTechnician ? 'Edit Technician' : 'Add New Technician'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTechnician 
                        ? 'Edit technician details below'
                        : 'Enter the details of the new technician'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...technicianForm}>
                    <form onSubmit={technicianForm.handleSubmit((data) => {
                      if (editingTechnician) {
                        updateTechnicianMutation.mutate({
                          id: editingTechnician.id,
                          ...data
                        });
                      } else {
                        createTechnicianMutation.mutate(data);
                      }
                    })} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={technicianForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={technicianForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={technicianForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={technicianForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={technicianForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Senior Technician" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={technicianForm.control}
                        name="specialty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specialty (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Hardware Repairs" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={technicianForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Active</FormLabel>
                              <FormDescription>
                                Inactive technicians won't appear in assignment lists
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button type="submit">
                          {editingTechnician ? 'Update Technician' : 'Add Technician'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingTechnicians ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : technicians.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserRound className="h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="text-lg font-medium">No technicians added yet</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Add technicians to assign them to repair tickets
                  </p>
                  <Button onClick={() => setShowTechnicianDialog(true)} variant="outline">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Your First Technician
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Specialty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {technicians.map((technician) => (
                        <TableRow key={technician.id}>
                          <TableCell>
                            <div className="font-medium">{technician.firstName} {technician.lastName}</div>
                          </TableCell>
                          <TableCell>{technician.role}</TableCell>
                          <TableCell>{technician.email}</TableCell>
                          <TableCell>{technician.specialty || '-'}</TableCell>
                          <TableCell>
                            {technician.isActive !== false ? (
                              <Badge>Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTechnician(technician);
                                  technicianForm.reset({
                                    firstName: technician.firstName,
                                    lastName: technician.lastName,
                                    email: technician.email,
                                    phone: technician.phone || '',
                                    role: technician.role,
                                    specialty: technician.specialty || '',
                                    isActive: technician.isActive !== false,
                                  });
                                  setShowTechnicianDialog(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog open={deletingTechnicianId === technician.id} onOpenChange={(open) => !open && setDeletingTechnicianId(null)}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => setDeletingTechnicianId(technician.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Technician</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this technician? This will remove them from any assigned repairs.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-500 hover:bg-red-600"
                                      onClick={() => deleteTechnicianMutation.mutate(technician.id)}
                                    >
                                      {deleteTechnicianMutation.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Data Management Tab */}
        <TabsContent value="data-management">
          <Card>
            <CardHeader>
              <CardTitle>Trash Management</CardTitle>
              <CardDescription>
                View and restore deleted records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="customers" onValueChange={setActiveTrashTab} value={activeTrashTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="customers">Customers</TabsTrigger>
                  <TabsTrigger value="devices">Devices</TabsTrigger>
                  <TabsTrigger value="repairs">Repair Tickets</TabsTrigger>
                  <TabsTrigger value="technicians">Technicians</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="quotes">Quotes</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                </TabsList>
                
                {/* Customers Trash */}
                <TabsContent value="customers">
                  {isLoadingDeletedCustomers ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedCustomers && deletedCustomers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedCustomers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.firstName} {customer.lastName}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell>{new Date(customer.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreCustomer(customer.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted customers found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Devices Trash */}
                <TabsContent value="devices">
                  {isLoadingDeletedDevices ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedDevices && deletedDevices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedDevices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell>{device.type}</TableCell>
                            <TableCell>{device.brand}</TableCell>
                            <TableCell>{device.model}</TableCell>
                            <TableCell>{device.serialNumber}</TableCell>
                            <TableCell>{new Date(device.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreDevice(device.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted devices found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Repairs Trash */}
                <TabsContent value="repairs">
                  {isLoadingDeletedRepairs ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedRepairs && deletedRepairs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Intake Date</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedRepairs.map((repair) => (
                          <TableRow key={repair.id}>
                            <TableCell className="font-medium">{repair.ticketNumber}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {repair.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{repair.issue.length > 30 ? `${repair.issue.substring(0, 30)}...` : repair.issue}</TableCell>
                            <TableCell>{new Date(repair.intakeDate).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(repair.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreRepair(repair.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted repair tickets found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Technicians Trash */}
                <TabsContent value="technicians">
                  {isLoadingDeletedTechnicians ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedTechnicians && deletedTechnicians.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Specialty</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedTechnicians.map((technician) => (
                          <TableRow key={technician.id}>
                            <TableCell className="font-medium">{technician.firstName} {technician.lastName}</TableCell>
                            <TableCell>{technician.email}</TableCell>
                            <TableCell>{technician.role}</TableCell>
                            <TableCell>{technician.specialty}</TableCell>
                            <TableCell>{new Date(technician.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreTechnician(technician.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted technicians found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Inventory Trash */}
                <TabsContent value="inventory">
                  {isLoadingDeletedInventoryItems ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedInventoryItems && deletedInventoryItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedInventoryItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>${item.price.toFixed(2)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{new Date(item.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreInventoryItem(item.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted inventory items found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Quotes Trash */}
                <TabsContent value="quotes">
                  {isLoadingDeletedQuotes ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedQuotes && deletedQuotes.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quote #</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedQuotes.map((quote) => (
                          <TableRow key={quote.id}>
                            <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                            <TableCell>${quote.total.toFixed(2)}</TableCell>
                            <TableCell>{quote.status}</TableCell>
                            <TableCell>{new Date(quote.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreQuote(quote.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted quotes found.
                    </div>
                  )}
                </TabsContent>
                
                {/* Invoices Trash */}
                <TabsContent value="invoices">
                  {isLoadingDeletedInvoices ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : deletedInvoices && deletedInvoices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Deleted At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>${invoice.total.toFixed(2)}</TableCell>
                            <TableCell>{invoice.status}</TableCell>
                            <TableCell>{new Date(invoice.deletedAt as string).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRestoreInvoice(invoice.id)}
                                className="flex items-center"
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No deleted invoices found.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Delete data from your system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-6 bg-gray-50">
                  <h3 className="text-lg font-medium text-red-600 mb-2">
                    Delete All Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will permanently delete all customers, repairs, inventory items, quotes, and invoices from your system.
                    This action cannot be undone. Default tax rates and currencies will be preserved.
                  </p>
                  <AlertDialog open={showDeleteAllDataConfirm} onOpenChange={setShowDeleteAllDataConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>
                            This action will permanently delete <strong>ALL</strong> of the following data:
                          </p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Customers</li>
                            <li>Devices</li>
                            <li>Technicians</li>
                            <li>Repairs & all repair items</li>
                            <li>Quotes</li>
                            <li>Invoices</li>
                            <li>Inventory</li>
                          </ul>
                          <p className="text-red-600 font-semibold mt-2">
                            This action cannot be undone. This will permanently delete all your data.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => {
                            const deleteAllData = async () => {
                              try {
                                await apiRequest('DELETE', '/api/settings/delete-all-data');
                                toast({
                                  title: "Success",
                                  description: "All data has been deleted successfully",
                                });
                                
                                // Invalidate all queries to refresh the UI
                                queryClient.invalidateQueries();
                              } catch (error: any) {
                                console.error('Error deleting all data:', error);
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to delete all data",
                                  variant: "destructive",
                                });
                              }
                            };
                            
                            deleteAllData();
                          }}
                        >
                          I understand, delete everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper function to get the current auth token
function getAuthToken(): string | null {
  try {
    // Try to get the token from localStorage
    const token = localStorage.getItem('firebase_token');
    if (token) {
      return token;
    }
    
    // If not found, try to get it from sessionStorage
    const sessionToken = sessionStorage.getItem('firebase_token');
    if (sessionToken) {
      return sessionToken;
    }
    
    console.warn('No authentication token found');
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

export default SettingsPage;