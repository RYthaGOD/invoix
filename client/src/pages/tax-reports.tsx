/**
 * Tax Reports Page
 * 
 * Annual tax data export for users to file their own taxes
 * No TIN storage, no IRS filing - just data export
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Receipt } from "lucide-react";

interface TaxSummary {
    taxYear: number;
    summary: {
        totalReceived: string;
        totalSent: string;
        netIncome: string;
        transactionCount: number;
        platformFeesPaid: string;
    };
    monthlyBreakdown: Array<{
        month: string;
        received: string;
        sent: string;
        invoiceCount: number;
    }>;
    byCustomer: Array<{
        customerWallet: string;
        totalAmount: string;
        invoiceCount: number;
    }>;
}

export default function TaxReports() {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Fetch available years
    const { data: yearsData } = useQuery({
        queryKey: ['tax-years'],
        queryFn: async () => {
            const response = await fetch('/api/tax/years', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error("Failed to fetch years");
            return response.json();
        }
    });

    // Fetch tax summary
    const { data: summaryData, isLoading } = useQuery({
        queryKey: ['tax-summary', selectedYear],
        queryFn: async () => {
            const response = await fetch(`/api/tax/summary/${selectedYear}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error("Failed to fetch summary");
            return response.json();
        },
        enabled: !!selectedYear
    });

    // Fetch threshold status
    const { data: thresholdData } = useQuery({
        queryKey: ['tax-threshold', selectedYear],
        queryFn: async () => {
            const response = await fetch(`/api/tax/threshold/${selectedYear}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error("Failed to fetch threshold");
            return response.json();
        },
        enabled: !!selectedYear
    });

    const summary: TaxSummary | undefined = summaryData?.data;
    const threshold = thresholdData?.data;

    const downloadCSV = async () => {
        const response = await fetch(`/api/tax/export/${selectedYear}/csv`, {
            credentials: 'include'
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoix-tax-${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Tax Reports</h1>
                <p className="text-muted-foreground">
                    Export your annual payment data for tax filing purposes
                </p>
            </div>

            {/* Tax Disclaimer */}
            <Alert className="mb-6 border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Important Tax Notice</AlertTitle>
                <AlertDescription className="text-yellow-700">
                    This report is for informational purposes only. Invoix does not file tax forms on your behalf.
                    If you received more than $600 in payments this year, you may need to report this income on your tax return.
                    Consult a tax professional for guidance. Invoix is not a tax advisor.
                </AlertDescription>
            </Alert>

            {/* Year Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Tax Year</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {yearsData?.years?.map((year: number) => (
                            <SelectItem key={year} value={year.toString()}>
                                {year}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {[1, 2, 3].map(i => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                    Total Received
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    ${parseFloat(summary?.summary.totalReceived || "0").toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Income</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                    Total Sent
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    ${parseFloat(summary?.summary.totalSent || "0").toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Expenses</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    Transactions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {summary?.summary.transactionCount || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Total count</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">1099-K Threshold</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {threshold?.exceedsThreshold ? (
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                                        <span className="text-sm font-medium text-yellow-700">Exceeded</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <span className="text-sm font-medium text-green-700">Below $600</span>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                    {threshold?.percentOfThreshold}% of threshold
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Download Actions */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <Button onClick={downloadCSV} variant="default">
                            <Download className="h-4 w-4 mr-2" />
                            Download CSV
                        </Button>
                        <Button variant="outline" disabled>
                            <FileText className="h-4 w-4 mr-2" />
                            Download PDF (Coming Soon)
                        </Button>
                    </div>

                    {/* Monthly Breakdown */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Monthly Breakdown</CardTitle>
                            <CardDescription>Income and expenses by month for {selectedYear}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-2 px-4">Month</th>
                                            <th className="text-right py-2 px-4">Received</th>
                                            <th className="text-right py-2 px-4">Sent</th>
                                            <th className="text-right py-2 px-4">Net</th>
                                            <th className="text-right py-2 px-4">Transactions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary?.monthlyBreakdown.map((month) => (
                                            <tr key={month.month} className="border-b hover:bg-muted/50">
                                                <td className="py-2 px-4">{month.month}</td>
                                                <td className="text-right py-2 px-4 text-green-600">
                                                    ${parseFloat(month.received).toFixed(2)}
                                                </td>
                                                <td className="text-right py-2 px-4 text-red-600">
                                                    ${parseFloat(month.sent).toFixed(2)}
                                                </td>
                                                <td className="text-right py-2 px-4 font-medium">
                                                    ${(parseFloat(month.received) - parseFloat(month.sent)).toFixed(2)}
                                                </td>
                                                <td className="text-right py-2 px-4 text-muted-foreground">
                                                    {month.invoiceCount}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Customers */}
                    {summary?.byCustomer && summary.byCustomer.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Customers</CardTitle>
                                <CardDescription>Businesses you invoiced in {selectedYear}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {summary.byCustomer.slice(0, 5).map((customer) => (
                                        <div key={customer.customerWallet} className="flex justify-between items-center">
                                            <div>
                                                <p className="font-mono text-sm">{customer.customerWallet.slice(0, 12)}...</p>
                                                <p className="text-xs text-muted-foreground">{customer.invoiceCount} invoices</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">${parseFloat(customer.totalAmount).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
