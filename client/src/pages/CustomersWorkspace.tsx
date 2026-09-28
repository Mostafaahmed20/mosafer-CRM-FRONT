import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AgencyContactRole,
  CustomerContact,
  CustomerDecisionRole,
  CustomerProfile,
  CustomerTag,
  customerApi,
  TravelerRecord,
} from "@/lib/api";
import { getAppSettings } from "@/lib/appSettings";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS: CustomerDecisionRole[] = [
  "Group Admin",
  "CEO",
  "Manager",
  "Decision Maker",
  "Owner",
  "Operations",
];

const TAG_OPTIONS: CustomerTag[] = ["VIP", "Risky", "Prepaid", "Blacklist Watch"];
const CONTACT_ROLE_OPTIONS: AgencyContactRole[] = [
  "CEO",
  "Manager",
  "Operations",
  "Accounting",
  "Sales",
  "Reservations",
  "Owner",
  "Other",
];

type FormState = {
  agencyName: string;
  phone: string;
  country: string;
  language: string;
  bookingValue: string;
  location: string;
  email: string;
  decisionRole: CustomerDecisionRole;
  tags: CustomerTag[];
  notes: string;
  contacts: CustomerContact[];
};

type ContactDraft = {
  name: string;
  email: string;
  role: AgencyContactRole;
  phone: string;
};

const EMPTY_FORM: FormState = {
  agencyName: "",
  phone: "",
  country: "",
  language: "",
  bookingValue: "",
  location: "",
  email: "",
  decisionRole: "Decision Maker",
  tags: [],
  notes: "",
  contacts: [],
};

const EMPTY_CONTACT_DRAFT: ContactDraft = {
  name: "",
  email: "",
  role: "Operations",
  phone: "",
};

export default function CustomersWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft>(EMPTY_CONTACT_DRAFT);
  const [travelersByCustomer, setTravelersByCustomer] = useState<Record<string, TravelerRecord[]>>({});
  const [expandedTravelerCustomerId, setExpandedTravelerCustomerId] = useState<string | null>(null);
  const [travelerDraft, setTravelerDraft] = useState({ firstName: "", lastName: "", displayNameArabic: "", email: "", phone: "", nationality: "" });
  const [savingTraveler, setSavingTraveler] = useState(false);

  const isAdminUser = String((user as any)?.role || "").toLowerCase() === "admin";
  const customerRules = getAppSettings().customerRules;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (isAuthenticated) loadCustomers();
  }, [isAuthenticated]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await customerApi.getAll();
      setCustomers(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCustomerTravelers = async (customer: CustomerProfile) => {
    if (expandedTravelerCustomerId === customer._id) {
      setExpandedTravelerCustomerId(null);
      return;
    }
    setExpandedTravelerCustomerId(customer._id);
    try {
      const travelers = await customerApi.getTravelers(customer._id);
      setTravelersByCustomer((previous) => ({ ...previous, [customer._id]: travelers }));
    } catch (error: any) {
      toast.error(error?.message || "Could not load travelers");
    }
  };

  const saveTraveler = async (customer: CustomerProfile) => {
    if (!travelerDraft.firstName.trim() || !travelerDraft.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    try {
      setSavingTraveler(true);
      const traveler = await customerApi.addTraveler(customer._id, travelerDraft);
      setTravelersByCustomer((previous) => ({
        ...previous,
        [customer._id]: [traveler, ...(previous[customer._id] || [])],
      }));
      setTravelerDraft({ firstName: "", lastName: "", displayNameArabic: "", email: "", phone: "", nationality: "" });
      toast.success("Traveler saved to customer profile");
    } catch (error: any) {
      toast.error(error?.message || "Could not save traveler");
    } finally {
      setSavingTraveler(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [
        c.agencyName,
        c.location,
        c.email,
        c.decisionRole,
        c.notes || "",
        ...(c.tags || []),
        ...(c.contacts || []).flatMap((contact) => [contact.name, contact.email, contact.role, contact.phone || ""]),
      ]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [customers, searchQuery]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingCustomerId(null);
    setContactDraft(EMPTY_CONTACT_DRAFT);
  };

  const validateAndMaybeWarnDuplicate = () => {
    const agencyKey = form.agencyName.trim().toLowerCase();
    const emailKey = form.email.trim().toLowerCase();
    const duplicate = customers.find((c) => {
      if (editingCustomerId && c._id === editingCustomerId) return false;
      const sameAgency = c.agencyName.trim().toLowerCase() === agencyKey;
      const sameEmail = emailKey ? c.email.trim().toLowerCase() === emailKey : false;
      return sameAgency || sameEmail;
    });
    if (!duplicate) return true;
    const duplicateByAgency = duplicate.agencyName.trim().toLowerCase() === agencyKey;
    const message = duplicateByAgency ? "Agency name already exists" : "Email already exists";
    if (customerRules.duplicateMode === "block") {
      toast.error(message);
      return false;
    }
    toast.warning(`${message} (warning only, save allowed)`);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.agencyName.trim()) {
      toast.error("Agency name is required");
      return;
    }
    if (customerRules.requireLocation && !form.location.trim()) {
      toast.error("Location is required");
      return;
    }
    if (customerRules.requireEmail && !form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (customerRules.requireDecisionRole && !form.decisionRole.trim()) {
      toast.error("Decision role is required");
      return;
    }
    if (!validateAndMaybeWarnDuplicate()) return;

    if (editingCustomerId && customerRules.adminOnlyEdit && !isAdminUser) {
      toast.error("Only admin can edit travel agency profiles");
      return;
    }

    const payload = {
      agencyName: form.agencyName,
      phone: form.phone,
      country: form.country,
      language: form.language,
      bookingValue: form.bookingValue,
      location: form.location,
      email: form.email,
      decisionRole: form.decisionRole,
      tags: form.tags,
      notes: form.notes,
      contacts: form.contacts,
    };

    setIsSaving(true);
    try {
      if (editingCustomerId) {
        const updated = await customerApi.update(editingCustomerId, payload);
        setCustomers((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
        toast.success("Agency profile updated");
      } else {
        const created = await customerApi.create(payload);
        setCustomers((prev) => [created, ...prev.filter((c) => c._id !== created._id)]);
        toast.success("Agency profile added");
      }
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save agency profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customer: CustomerProfile) => {
    if (customerRules.adminOnlyDelete && !isAdminUser) {
      toast.error("Only admin can delete travel agency profiles");
      return;
    }
    try {
      await customerApi.delete(customer._id);
      setCustomers((prev) => prev.filter((c) => c._id !== customer._id));
      toast.success("Agency profile removed");
      if (editingCustomerId === customer._id) resetForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete agency profile");
    }
  };

  const startEdit = (customer: CustomerProfile) => {
    if (customerRules.adminOnlyEdit && !isAdminUser) {
      toast.error("Only admin can edit travel agency profiles");
      return;
    }
    setEditingCustomerId(customer._id);
    setForm({
      agencyName: customer.agencyName,
      phone: customer.phone || "",
      country: customer.country || "",
      language: customer.language || "",
      bookingValue: customer.bookingValue || "",
      location: customer.location,
      email: customer.email,
      decisionRole: customer.decisionRole,
      tags: customer.tags || [],
      notes: customer.notes || "",
      contacts: customer.contacts || [],
    });
    setContactDraft(EMPTY_CONTACT_DRAFT);
  };

  const toggleTag = (tag: CustomerTag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const addContact = () => {
    if (!contactDraft.name.trim() || !contactDraft.email.trim()) {
      toast.error("Contact name and email are required");
      return;
    }
    const duplicate = form.contacts.find((c) => c.email.trim().toLowerCase() === contactDraft.email.trim().toLowerCase());
    if (duplicate) {
      toast.error("Contact email already added");
      return;
    }
    const nextContact: CustomerContact = {
      id: `ct_${Math.random().toString(36).slice(2, 10)}`,
      name: contactDraft.name.trim(),
      email: contactDraft.email.trim().toLowerCase(),
      role: contactDraft.role,
      phone: contactDraft.phone.trim() || undefined,
    };
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, nextContact] }));
    setContactDraft(EMPTY_CONTACT_DRAFT);
  };

  const removeContact = (id: string) => {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((c) => c.id !== id) }));
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="max-w-2xl space-y-6">
          <div className="hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Workspace</div>
                <h1 className="text-xl font-semibold">Customers / Travel Agencies</h1>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Add agency profiles with tags, contacts, and notes. Reuse them when creating boards.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{editingCustomerId ? "Edit Client Details" : "Add Client Details"}</div>
                <Plus className="w-4 h-4 text-slate-400" />
              </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Client name</label>
                <Input value={form.agencyName} onChange={(e) => setForm((p) => ({ ...p, agencyName: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Phone number</label>
                  <Input type="tel" placeholder="+966 53 300 2349" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Country</label>
                  <Input placeholder="Saudi Arabia" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Language</label>
                  <Input placeholder="Arabic" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Booking value</label>
                  <Input placeholder="Value in SAR" value={form.bookingValue} onChange={(e) => setForm((p) => ({ ...p, bookingValue: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Location</label>
                  <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Agency email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Primary decision role</label>
                <select
                  value={form.decisionRole}
                  onChange={(e) => setForm((p) => ({ ...p, decisionRole: e.target.value as CustomerDecisionRole }))}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Customer tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => {
                    const active = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                          active
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Additional contacts</div>
                  <div className="text-xs text-slate-500">{form.contacts.length} contact(s)</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Contact name"
                    value={contactDraft.name}
                    onChange={(e) => setContactDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    type="email"
                    placeholder="contact@agency.com"
                    value={contactDraft.email}
                    onChange={(e) => setContactDraft((p) => ({ ...p, email: e.target.value }))}
                  />
                  <select
                    value={contactDraft.role}
                    onChange={(e) => setContactDraft((p) => ({ ...p, role: e.target.value as AgencyContactRole }))}
                    className="h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                  >
                    {CONTACT_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Phone (optional)"
                    value={contactDraft.phone}
                    onChange={(e) => setContactDraft((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addContact}>
                  Add Contact
                </Button>

                {form.contacts.length > 0 && (
                  <div className="space-y-2">
                    {form.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{contact.name} <span className="text-slate-500">({contact.role})</span></div>
                          <div className="text-xs text-slate-500 break-all">{contact.email}</div>
                          {contact.phone && <div className="text-xs text-slate-500">{contact.phone}</div>}
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeContact(contact.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Agency notes</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Payment behavior, preferences, escalation notes, blacklist warnings, etc."
                  className="min-h-24"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCustomerId ? "Update Client Details" : "Save Client Details"}
                </Button>
                {editingCustomerId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                    Cancel
                  </Button>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rules come from Settings {"->"} Customer Rules. Backend should enforce duplicates and permissions for real security.
              </p>
            </form>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="font-semibold">Saved Agency Profiles</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{customers.length} total profiles</div>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search agencies, tags, contacts..." className="pl-9" />
                </div>
              </div>

              {isLoading ? (
                <div className="py-14 flex items-center justify-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading agencies...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="font-medium mb-1">No agency profiles yet</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Add your first travel agency on the left.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCustomers.map((customer) => (
                    <div key={customer._id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{customer.agencyName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {customer.location || "-"} | {customer.decisionRole} | {customer.email || "-"}
                          </div>

                          {customer.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {customer.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {customer.contacts?.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contacts</div>
                              {customer.contacts.slice(0, 3).map((contact) => (
                                <div key={contact.id} className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                  {contact.role}: {contact.name} ({contact.email})
                                </div>
                              ))}
                              {customer.contacts.length > 3 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">+{customer.contacts.length - 3} more contacts</div>
                              )}
                            </div>
                          )}

                          {customer.notes && (
                            <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                              {customer.notes}
                            </div>
                          )}

                          {customer.history?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">History</div>
                              <div className="space-y-1">
                                {customer.history.slice(-3).reverse().map((event) => (
                                  <div key={event.id} className="text-xs text-slate-500 dark:text-slate-400">
                                    {event.action} - {new Date(event.at).toLocaleString()}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggleCustomerTravelers(customer)}
                          >
                            <Users className="mr-1 h-4 w-4" />
                            Travelers
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(customer)}
                            disabled={customerRules.adminOnlyEdit && !isAdminUser}
                            title={customerRules.adminOnlyEdit && !isAdminUser ? "Admin only" : "Edit agency profile"}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(customer)}
                            disabled={customerRules.adminOnlyDelete && !isAdminUser}
                            title={customerRules.adminOnlyDelete && !isAdminUser ? "Admin only" : "Delete agency profile"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {expandedTravelerCustomerId === customer._id && (
                        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div className="mb-3 text-sm font-semibold">Travelers linked to {customer.agencyName}</div>
                          <div className="mb-4 flex flex-wrap gap-2">
                            {(travelersByCustomer[customer._id] || []).map((traveler) => (
                              <div key={traveler._id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                                <div className="font-medium">{traveler.firstName} {traveler.lastName}</div>
                                {(traveler.displayNameArabic || traveler.nationality) && (
                                  <div className="text-slate-500 dark:text-slate-400">
                                    {[traveler.displayNameArabic, traveler.nationality].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </div>
                            ))}
                            {!(travelersByCustomer[customer._id] || []).length && (
                              <div className="text-xs text-slate-500">No travelers linked yet.</div>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <Input placeholder="First name" value={travelerDraft.firstName} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, firstName: event.target.value }))} />
                            <Input placeholder="Last name" value={travelerDraft.lastName} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, lastName: event.target.value }))} />
                            <Input placeholder="Arabic display name" value={travelerDraft.displayNameArabic} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, displayNameArabic: event.target.value }))} />
                            <Input placeholder="Email" type="email" value={travelerDraft.email} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, email: event.target.value }))} />
                            <Input placeholder="Phone" value={travelerDraft.phone} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, phone: event.target.value }))} />
                            <Input placeholder="Nationality" value={travelerDraft.nationality} onChange={(event) => setTravelerDraft((draft) => ({ ...draft, nationality: event.target.value }))} />
                          </div>
                          <Button type="button" size="sm" className="mt-3" onClick={() => void saveTraveler(customer)} disabled={savingTraveler}>
                            {savingTraveler ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Add traveler
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
