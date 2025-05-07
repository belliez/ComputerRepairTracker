import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import InformationSection from "./information-section";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { repairStatuses } from "@shared/schema";

interface RepairInformationProps {
  repair: any;
  onRepairUpdated?: () => void;
  readOnly?: boolean;
}

export default function RepairInformation({ 
  repair, 
  onRepairUpdated,
  readOnly = false
}: RepairInformationProps) {
  const { toast } = useToast();
  
  // Get technicians for the form
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });
  
  // Form validation schema
  const formSchema = z.object({
    status: z.enum(repairStatuses),
    issue: z.string().min(1, { message: "Issue description is required" }),
    notes: z.string().optional(),
    technicianId: z.number().optional().nullable(),
    priorityLevel: z.coerce.number().min(1).max(5),
    isUnderWarranty: z.boolean().default(false),
    estimatedCompletionDate: z.string().optional(),
    diagnosticNotes: z.string().optional().nullable(),
  });

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: repair?.status || "intake",
      issue: repair?.issue || "",
      notes: repair?.notes || "",
      technicianId: repair?.technicianId || null,
      priorityLevel: repair?.priorityLevel || 3,
      isUnderWarranty: repair?.isUnderWarranty || false,
      estimatedCompletionDate: repair?.estimatedCompletionDate 
        ? format(new Date(repair.estimatedCompletionDate), "yyyy-MM-dd")
        : "",
      diagnosticNotes: repair?.diagnosticNotes || "",
    }
  });

  // Update form when repair data changes
  useEffect(() => {
    if (repair) {
      form.reset({
        status: repair.status || "intake",
        issue: repair.issue || "",
        notes: repair.notes || "",
        technicianId: repair.technicianId || null,
        priorityLevel: repair.priorityLevel || 3,
        isUnderWarranty: repair.isUnderWarranty || false,
        estimatedCompletionDate: repair.estimatedCompletionDate 
          ? format(new Date(repair.estimatedCompletionDate), "yyyy-MM-dd")
          : "",
        diagnosticNotes: repair.diagnosticNotes || "",
      });
    }
  }, [repair, form]);

  // Repair update mutation
  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest("PUT", `/api/repairs/${repair.id}`, data);
    },
    onSuccess: () => {
      // Invalidate and refetch repair data
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repair.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repair.id}/details`] });
      
      toast({
        title: "Repair updated",
        description: "Repair information has been updated successfully",
      });
      
      if (onRepairUpdated) {
        onRepairUpdated();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update repair: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate(data);
  };

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  if (!repair) {
    return <div>No repair information available</div>;
  }

  // Helper function for status badge
  const getStatusBadge = (status: string) => {
    let color;
    switch (status) {
      case "intake":
        color = "bg-blue-100 text-blue-800";
        break;
      case "in-progress":
        color = "bg-yellow-100 text-yellow-800";
        break;
      case "awaiting-parts":
        color = "bg-purple-100 text-purple-800";
        break;
      case "on-hold":
        color = "bg-gray-100 text-gray-800";
        break;
      case "completed":
        color = "bg-green-100 text-green-800";
        break;
      case "cancelled":
        color = "bg-red-100 text-red-800";
        break;
      default:
        color = "bg-gray-100 text-gray-800";
    }
    
    return (
      <Badge variant="outline" className={`${color} border-none`}>
        {status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  // Helper function for priority badge
  const getPriorityBadge = (level: number) => {
    let color;
    let text;
    
    switch (level) {
      case 1:
        color = "bg-red-100 text-red-800";
        text = "Urgent";
        break;
      case 2:
        color = "bg-orange-100 text-orange-800";
        text = "High";
        break;
      case 3:
        color = "bg-blue-100 text-blue-800";
        text = "Normal";
        break;
      case 4:
        color = "bg-green-100 text-green-800";
        text = "Low";
        break;
      case 5:
        color = "bg-gray-100 text-gray-800";
        text = "Very Low";
        break;
      default:
        color = "bg-blue-100 text-blue-800";
        text = "Normal";
    }
    
    return (
      <Badge variant="outline" className={`${color} border-none`}>
        {text}
      </Badge>
    );
  };

  // Edit form content
  const editForm = (
    <Form {...form}>
      <form className="space-y-3">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {repairStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="issue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Issue</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe the issue with the device"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="technicianId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assigned Technician</FormLabel>
              <Select
                value={field.value?.toString() || "null"}
                onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign a technician" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="null">None</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id.toString()}>
                      {tech.firstName} {tech.lastName} ({tech.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="priorityLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  className="flex space-x-2"
                >
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="1" />
                    </FormControl>
                    <FormLabel className="text-xs cursor-pointer">Urgent</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="2" />
                    </FormControl>
                    <FormLabel className="text-xs cursor-pointer">High</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="3" />
                    </FormControl>
                    <FormLabel className="text-xs cursor-pointer">Normal</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="4" />
                    </FormControl>
                    <FormLabel className="text-xs cursor-pointer">Low</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="5" />
                    </FormControl>
                    <FormLabel className="text-xs cursor-pointer">Very Low</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="isUnderWarranty"
            render={({ field }) => (
              <FormItem className="flex items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Under Warranty</FormLabel>
                  <FormDescription>
                    Is this repair covered by warranty?
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="estimatedCompletionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Est. Completion Date</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    {...field} 
                    value={field.value || ''} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="diagnosticNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Diagnostic Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notes from diagnosis"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Any additional notes about this repair"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );

  // Display view content
  const displayContent = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="font-medium">Issue</span>
          <p className="text-gray-700">{repair.issue}</p>
        </div>
        
        <div className="space-y-1">
          <div>
            <span className="font-medium">Status</span>
            <div className="mt-1">{getStatusBadge(repair.status)}</div>
          </div>
          
          <div>
            <span className="font-medium">Priority</span>
            <div className="mt-1">{getPriorityBadge(repair.priorityLevel)}</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="font-medium">Intake Date</span>
          <p className="text-gray-700">
            {repair.intakeDate
              ? format(new Date(repair.intakeDate), "MMMM d, yyyy")
              : "Not specified"}
          </p>
        </div>
        
        <div>
          <span className="font-medium">Estimated Completion</span>
          <p className="text-gray-700">
            {repair.estimatedCompletionDate
              ? format(new Date(repair.estimatedCompletionDate), "MMMM d, yyyy")
              : "Not specified"}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="font-medium">Assigned Technician</span>
          <p className="text-gray-700">
            {repair.technician
              ? `${repair.technician.firstName} ${repair.technician.lastName} (${repair.technician.role})`
              : "Unassigned"}
          </p>
        </div>
        
        <div>
          <span className="font-medium">Warranty</span>
          <p className="text-gray-700">
            {repair.isUnderWarranty ? "Yes - Under Warranty" : "No - Not Under Warranty"}
          </p>
        </div>
      </div>

      {repair.diagnosticNotes && (
        <div>
          <span className="font-medium">Diagnostic Notes</span>
          <p className="text-gray-700 whitespace-pre-line">{repair.diagnosticNotes}</p>
        </div>
      )}

      {repair.notes && (
        <div>
          <span className="font-medium">Additional Notes</span>
          <p className="text-gray-700 whitespace-pre-line">{repair.notes}</p>
        </div>
      )}
    </div>
  );

  return (
    <InformationSection
      title="Repair Information"
      editForm={readOnly ? undefined : editForm}
      onSave={handleSave}
      canEdit={!readOnly}
    >
      {displayContent}
    </InformationSection>
  );
}