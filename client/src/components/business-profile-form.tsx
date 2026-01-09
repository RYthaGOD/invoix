
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Upload, Shield } from "lucide-react";
import { useEffect, useRef } from "react";

const profileSchema = z.object({
    businessName: z.string().min(1, "Business Name is required"),
    businessEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
    businessPhone: z.string().optional(),
    businessAddress: z.string().optional(),
    businessWebsite: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    taxId: z.string().optional(),
    taxRegistrationNumber: z.string().optional(),
    defaultPaymentTerms: z.string().optional(),
    defaultInvoicePrefix: z.string().min(1, "Prefix required").max(10, "Too long"),
    // New Fields
    brandColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be valid hex color ie #000000").default("#3b82f6"),
    defaultPrivacySettings: z.boolean().default(true),
    nextInvoiceNumber: z.coerce.number().int().min(1, "Must be at least 1").default(1),
    logoUrl: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function BusinessProfileForm() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Fetch Profile
    const { data, isLoading } = useQuery({
        queryKey: ["/api/business/profile"],
        queryFn: async () => {
            const res = await fetch("/api/business/profile", { credentials: 'include' });
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
            brandColor: "#3b82f6",
            defaultPrivacySettings: true,
            nextInvoiceNumber: 1,
            logoUrl: "",
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
                brandColor: profile.brandColor || "#3b82f6",
                defaultPrivacySettings: profile.defaultPrivacySettings !== undefined ? profile.defaultPrivacySettings : true,
                nextInvoiceNumber: profile.nextInvoiceNumber || 1,
                logoUrl: profile.logoUrl || "",
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

    // Logo Upload Logic
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result as string;
            try {
                toast({ title: "Uploading Logo...", description: "Please wait." });
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ fileData: base64, fileName: file.name })
                });
                const data = await res.json();

                if (data.success) {
                    form.setValue('logoUrl', data.url, { shouldDirty: true });
                    toast({ title: "Logo Uploaded", description: "Don't forget to save your profile!" });
                } else {
                    throw new Error(data.message);
                }
            } catch (err: any) {
                toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
            }
        };
        reader.readAsDataURL(file);
    };

    function onSubmit(values: ProfileFormValues) {
        mutation.mutate(values);
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mb-8">

                {/* Branding Section */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Branding
                    </h3>

                    <div className="flex items-start gap-6 border p-6 rounded-lg bg-muted/20">
                        {/* Logo Preview/Upload */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-24 h-24 border rounded-lg bg-background flex items-center justify-center overflow-hidden relative group">
                                {form.watch('logoUrl') ? (
                                    <img src={form.watch('logoUrl')} alt="Business Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-xs text-muted-foreground text-center p-2">No Logo</span>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="text-white w-6 h-6" />
                                </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                Change Logo
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/png, image/jpeg, image/jpg"
                                onChange={handleLogoUpload}
                            />
                        </div>

                        {/* Brand Color & Name */}
                        <div className="flex-1 space-y-4">
                            <FormField
                                control={form.control}
                                name="businessName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Business Name *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Acme Corp" className="text-lg font-medium" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="brandColor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Brand Color</FormLabel>
                                            <div className="flex gap-2">
                                                <div className="w-10 h-10 rounded-md border shadow-sm shrink-0" style={{ backgroundColor: field.value }} />
                                                <FormControl>
                                                    <Input placeholder="#3b82f6" {...field} />
                                                </FormControl>
                                            </div>
                                            <FormDescription>Hex color code for your invoice theme.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Column: Contact Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact Information</h3>

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
                            name="businessAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Physical Address</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123 Market St, San Francisco, CA" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Right Column: Tax & Invoice Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Invoice Configuration</h3>

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
                                name="nextInvoiceNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Next Invoice #</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} {...field} />
                                        </FormControl>
                                        <FormDescription>Start your numbering (e.g. 1001)</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="defaultPrivacySettings"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20 mt-2">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-primary" />
                                            Private by Default
                                        </FormLabel>
                                        <FormDescription>
                                            Only allow invoice recipients to view details.
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
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" disabled={mutation.isPending} size="lg">
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Business Profile
                    </Button>
                </div>
            </form>
        </Form>
    );
}
