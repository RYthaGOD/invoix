
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have this, otherwise use Input
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";

const profileSchema = z.object({
    businessName: z.string().min(1, "Business Name is required"),
    businessEmail: z.string().email().optional().or(z.literal("")),
    businessPhone: z.string().optional(),
    businessAddress: z.string().optional(),
    businessWebsite: z.string().url().optional().or(z.literal("")),
    taxId: z.string().optional(),
    taxRegistrationNumber: z.string().optional(),
    defaultPaymentTerms: z.string().optional(),
    defaultInvoicePrefix: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function BusinessProfileForm() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // 1. Fetch Profile
    const { data, isLoading } = useQuery({
        queryKey: ["/api/business/profile"],
        queryFn: async () => {
            const res = await fetch("/api/business/profile");
            if (!res.ok) throw new Error("Failed to fetch profile");
            return res.json();
        },
    });

    const profile = data?.profile;

    // 2. Form Setup
    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            businessName: "",
            businessEmail: "",
            businessPhone: "",
            businessAddress: "",
            businessWebsite: "",
            taxId: "",
            taxRegistrationNumber: "",
            defaultPaymentTerms: "Net 30",
            defaultInvoicePrefix: "INV",
        },
    });

    // 3. Reset form when data loads
    useEffect(() => {
        if (profile) {
            form.reset({
                businessName: profile.businessName || "",
                businessEmail: profile.businessEmail || "",
                businessPhone: profile.businessPhone || "",
                businessAddress: profile.businessAddress || "",
                businessWebsite: profile.businessWebsite || "",
                taxId: profile.taxId || "",
                taxRegistrationNumber: profile.taxRegistrationNumber || "",
                defaultPaymentTerms: profile.defaultPaymentTerms || "Net 30",
                defaultInvoicePrefix: profile.defaultInvoicePrefix || "INV",
            });
        }
    }, [profile, form]);

    // 4. Mutation
    const mutation = useMutation({
        mutationFn: async (values: ProfileFormValues) => {
            const res = await fetch("/api/business/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Required for session cookie
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            return data;
        },
        onSuccess: () => {
            toast({ title: "Profile Saved", description: "Your business details have been updated." });
            queryClient.invalidateQueries({ queryKey: ["/api/business/profile"] });
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });

    function onSubmit(values: ProfileFormValues) {
        mutation.mutate(values);
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mb-8">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Column: Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">General Information</h3>

                        <FormField
                            control={form.control}
                            name="businessName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Business Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Acme Corp" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="businessEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="contact@acme.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="businessPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+1 (555) 000-0000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="businessWebsite"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Website</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://acme.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Right Column: Address & Tax */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Billing Details</h3>

                        <FormField
                            control={form.control}
                            name="businessAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Physical Address</FormLabel>
                                    <FormControl>
                                        {/* Using Input for now, switch to Textarea if available/needed */}
                                        <Input placeholder="123 Market St, San Francisco, CA" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="taxId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tax ID / EIN</FormLabel>
                                        <FormControl>
                                            <Input placeholder="XX-XXXXXXX" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="taxRegistrationNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reg Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="VAT / Business Reg" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="defaultInvoicePrefix"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Invoice Prefix</FormLabel>
                                        <FormControl>
                                            <Input placeholder="INV" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="defaultPaymentTerms"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Default Terms</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Net 30" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Business Details
                    </Button>
                </div>
            </form>
        </Form>
    );
}
