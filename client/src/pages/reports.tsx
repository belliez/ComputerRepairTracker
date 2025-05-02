import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { Repair, Technician, Invoice } from "@shared/schema";
import { repairStatuses, statusConfigs } from "@/types";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Reports() {
  const [timeRange, setTimeRange] = useState("month");
  const [reportTab, setReportTab] = useState("overview");
  
  // Get data for reports
  const { data: repairs } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });
  
  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });
  
  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });
  
  // Helper function to filter data by date range
  const filterByDateRange = (date: Date) => {
    const now = new Date();
    if (timeRange === "month") {
      return date >= startOfMonth(now) && date <= endOfMonth(now);
    } else if (timeRange === "quarter") {
      return date >= startOfMonth(subMonths(now, 3)) && date <= endOfMonth(now);
    } else if (timeRange === "year") {
      return date >= startOfYear(now) && date <= endOfYear(now);
    }
    return true; // all time
  };
  
  // Prepare data for reports based on time range
  const filteredRepairs = repairs?.filter(repair => {
    const intakeDate = new Date(repair.intakeDate);
    return filterByDateRange(intakeDate);
  }) || [];
  
  const filteredInvoices = invoices?.filter(invoice => {
    const dateIssued = new Date(invoice.dateIssued);
    return filterByDateRange(dateIssued);
  }) || [];
  
  // Status Distribution
  const statusDistribution = repairStatuses.map(status => {
    const count = filteredRepairs.filter(repair => repair.status === status).length;
    return {
      name: statusConfigs[status].label,
      value: count,
      color: getStatusColor(status),
    };
  }).filter(item => item.value > 0);
  
  // Revenue by Month Chart Data
  const revenueByMonth = generateMonthlyRevenue(invoices || []);
  
  // Technician Performance
  const technicianPerformance = technicians?.map(tech => {
    const techRepairs = filteredRepairs.filter(repair => repair.technicianId === tech.id);
    const completedRepairs = techRepairs.filter(repair => repair.status === "completed");
    const completionRate = techRepairs.length > 0 ? (completedRepairs.length / techRepairs.length) * 100 : 0;
    
    return {
      id: tech.id,
      name: `${tech.firstName} ${tech.lastName}`,
      role: tech.role,
      totalRepairs: techRepairs.length,
      completedRepairs: completedRepairs.length,
      completionRate,
    };
  }).sort((a, b) => b.totalRepairs - a.totalRepairs) || [];
  
  // Revenue Summary
  const totalRevenue = filteredInvoices.reduce((acc, inv) => acc + inv.total, 0);
  const paidRevenue = filteredInvoices.filter(inv => inv.status === "paid").reduce((acc, inv) => acc + inv.total, 0);
  const averageInvoice = filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0;
  
  // Repair Summary
  const totalRepairsCount = filteredRepairs.length;
  const completedRepairsCount = filteredRepairs.filter(r => r.status === "completed").length;
  const pendingApprovalCount = filteredRepairs.filter(r => r.status === "awaiting_approval").length;
  const inProgressCount = filteredRepairs.filter(r => ["diagnosing", "in_repair", "parts_ordered"].includes(r.status)).length;
  
  // Helper function to get status color
  function getStatusColor(status: string) {
    const colorMap: Record<string, string> = {
      intake: "#F59E0B", // yellow
      diagnosing: "#3B82F6", // blue
      awaiting_approval: "#8B5CF6", // purple
      parts_ordered: "#60A5FA", // light blue
      in_repair: "#F97316", // orange
      ready_for_pickup: "#10B981", // green
      completed: "#6B7280", // gray
      on_hold: "#EF4444", // red
      cancelled: "#EF4444", // red
    };
    return colorMap[status] || "#6B7280";
  }
  
  // Helper function to generate monthly revenue data
  function generateMonthlyRevenue(invoiceData: Invoice[]) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    
    // Initialize revenue data for each month
    const revenueData = months.map(month => ({
      month,
      revenue: 0,
      paid: 0,
      unpaid: 0,
    }));
    
    // Fill in actual revenue data
    invoiceData.forEach(invoice => {
      const date = new Date(invoice.dateIssued);
      const monthIndex = date.getMonth();
      
      revenueData[monthIndex].revenue += invoice.total;
      
      if (invoice.status === "paid") {
        revenueData[monthIndex].paid += invoice.total;
      } else {
        revenueData[monthIndex].unpaid += invoice.total;
      }
    });
    
    return revenueData;
  }
  
  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500">Analytics and performance metrics</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Select
            value={timeRange}
            onValueChange={setTimeRange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <i className="fas fa-download mr-1"></i> Export
          </Button>
        </div>
      </div>
      
      {/* Report Tabs */}
      <Tabs 
        defaultValue="overview" 
        value={reportTab} 
        onValueChange={setReportTab}
        className="mb-6"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Repairs</div>
                <div className="text-3xl font-bold text-gray-800">{totalRepairsCount}</div>
                <div className="mt-2 text-xs text-gray-400">
                  {timeRange === "month" ? "This month" : 
                   timeRange === "quarter" ? "Last 3 months" : 
                   timeRange === "year" ? "This year" : "All time"}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Completion Rate</div>
                <div className="text-3xl font-bold text-green-600">
                  {totalRepairsCount > 0 
                    ? Math.round((completedRepairsCount / totalRepairsCount) * 100)
                    : 0}%
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {completedRepairsCount} completed
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-blue-600">
                  ${totalRevenue.toFixed(2)}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  ${paidRevenue.toFixed(2)} collected
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Average Invoice</div>
                <div className="text-3xl font-bold text-purple-600">
                  ${averageInvoice.toFixed(2)}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {filteredInvoices.length} invoices
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Repair Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} repairs`, ""]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80">
                    <p className="text-gray-500">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value}`, ""]} />
                      <Legend />
                      <Bar dataKey="paid" fill="#10B981" name="Paid" />
                      <Bar dataKey="unpaid" fill="#EF4444" name="Unpaid" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Top Technicians */}
          <Card>
            <CardHeader>
              <CardTitle>Top Technicians</CardTitle>
              <CardDescription>Based on repair volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {technicianPerformance.slice(0, 3).map((tech) => (
                  <Card key={tech.id}>
                    <CardContent className="p-4">
                      <div className="font-medium text-lg mb-1">{tech.name}</div>
                      <div className="text-sm text-gray-500 mb-3">{tech.role}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Total Repairs:</div>
                        <div className="text-right font-medium">{tech.totalRepairs}</div>
                        <div>Completed:</div>
                        <div className="text-right font-medium">{tech.completedRepairs}</div>
                        <div>Completion Rate:</div>
                        <div className="text-right font-medium">{tech.completionRate.toFixed(0)}%</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Repairs Tab */}
        <TabsContent value="repairs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Repairs</div>
                <div className="text-3xl font-bold text-gray-800">{totalRepairsCount}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Completed</div>
                <div className="text-3xl font-bold text-green-600">{completedRepairsCount}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">In Progress</div>
                <div className="text-3xl font-bold text-blue-600">{inProgressCount}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Pending Approval</div>
                <div className="text-3xl font-bold text-purple-600">{pendingApprovalCount}</div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Repair Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {repairStatuses.map(status => {
                const count = filteredRepairs.filter(repair => repair.status === status).length;
                const percentage = totalRepairsCount > 0 ? (count / totalRepairsCount) * 100 : 0;
                
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getStatusColor(status) }}
                        ></div>
                        <span className="text-sm text-gray-700">{statusConfigs[status].label}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{count}</span>
                        <span className="text-gray-500 ml-2">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-2"
                      indicatorClassName={`bg-[${getStatusColor(status)}]`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
          
          {/* More detailed repair charts could go here */}
        </TabsContent>
        
        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-blue-600">${totalRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Collected</div>
                <div className="text-3xl font-bold text-green-600">${paidRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Outstanding</div>
                <div className="text-3xl font-bold text-red-500">${(totalRevenue - paidRevenue).toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, ""]} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3B82F6" name="Total Revenue" />
                    <Bar dataKey="paid" fill="#10B981" name="Collected" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* More revenue analysis could go here */}
        </TabsContent>
        
        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technician Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {technicianPerformance.map((tech) => (
                  <div key={tech.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{tech.name}</div>
                        <div className="text-sm text-gray-500">{tech.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          {tech.completedRepairs} of {tech.totalRepairs} repairs completed
                        </div>
                        <div className="text-sm font-medium text-blue-600">
                          {tech.completionRate.toFixed(0)}% completion rate
                        </div>
                      </div>
                    </div>
                    <Progress value={tech.completionRate} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* More technician analysis could go here */}
        </TabsContent>
      </Tabs>
    </>
  );
}
