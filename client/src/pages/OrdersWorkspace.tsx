import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "";

function orderAttachmentUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${API_URL}${url}`;
}

async function getApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.message === "string" ? body.message : fallback);
}

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  accountingStatus?: "not_ready" | "sent" | "received" | "closed";
  accountingReference?: string;
  sourceCardId?: string;
  sourceBoardId?: string;
  customerId: string | { _id: string; customerName?: string; agencyName?: string; email?: string };
  currency: string;
  saleSubtotal: number;
  customerTotal: number;
  totalCost: number;
  grossMargin: number;
  amountPaid: number;
  balance: number;
  createdAt?: string;
  updatedAt?: string;
  items?: Array<Record<string, unknown>>;
};

type OrderPackageSummary = {
  packageId: string;
  packageName: string;
  status: string;
  travelerCount: number;
  itemCount: number;
  totalServices: number;
  hasSchedule: boolean;
};

type PackageDraft = {
  packageName: string;
  status: string;
  travelerIds: string[];
  items: PackageItem[];
};

type PackageItem = {
  title: string;
  serviceType: string;
  startDate?: string;
  endDate?: string;
};

type Traveler = {
  _id: string;
  travelerId?: string;
  firstName: string;
  lastName: string;
  displayNameArabic?: string;
  nationality?: string;
};

type Fulfillment = {
  _id: string;
  orderItemId?: string;
  supplierName?: string;
  supplierReference?: string;
  hotelConfirmationNumber?: string;
  supplierInvoiceReference?: string;
  supplierInvoiceAmount?: number;
  supplierInvoiceDueAt?: string;
  supplierInvoiceAttachments?: Array<{ _id?: string; name: string; url: string; type?: string; size?: number; uploadedAt?: string }>;
  supplierInvoiceSettlement?: { paid: number; outstanding: number; status: string } | null;
  supplierPayments?: Array<{ _id: string; amount: number; paymentReference?: string; paymentMethod: string; paidAt: string; recordedBy: string }>;
  serviceType?: string;
  notes?: string;
  status: string;
  history?: Array<{ field: string; from: string; to: string; changedBy: string; changedAt: string }>;
  tasks?: Array<{ taskId?: string; title: string; status: string }>;
};

type FulfillmentDraft = Pick<Fulfillment, "supplierName" | "supplierReference" | "hotelConfirmationNumber" | "serviceType" | "notes"> & {
  orderItemId: string;
  supplierInvoiceReference: string;
  supplierInvoiceAmount: string;
  supplierInvoiceDueAt: string;
};

type SupplierPaymentDraft = { amount: string; paymentReference: string; requestKey?: string };

type Payment = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  paymentReference?: string;
  createdAt?: string;
  attachments?: Array<{ _id?: string; name: string; url: string; type?: string; size?: number; uploadedAt?: string }>;
};

type Amendment = { _id: string; reason: string; status: "requested" | "approved" | "rejected" | "completed"; decisionNotes?: string; createdAt?: string };
type ServiceDraft = { description: string; quantity: number; salePrice: number };

type SupplierPayable = {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  customer: Order["customerId"];
  currency: string;
  supplierName: string;
  invoiceReference: string;
  invoiceAmount: number;
  dueAt?: string;
  serviceDescription: string;
  settlement: { paid: number; outstanding: number; status: string };
  fulfillmentStatus: string;
};

export default function OrdersWorkspace() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [packageSummaries, setPackageSummaries] = useState<Record<string, OrderPackageSummary[]>>({});
  const [packageDrafts, setPackageDrafts] = useState<Record<string, PackageDraft>>({});
  const [travelers, setTravelers] = useState<Record<string, Traveler[]>>({});
  const [customerTravelers, setCustomerTravelers] = useState<Record<string, Traveler[]>>({});
  const [selectedCustomerTraveler, setSelectedCustomerTraveler] = useState<Record<string, string>>({});
  const [newTravelerDrafts, setNewTravelerDrafts] = useState<Record<string, { firstName: string; lastName: string }>>({});
  const [showAddTraveler, setShowAddTraveler] = useState<Record<string, boolean>>({});
  const [accountingReadiness, setAccountingReadiness] = useState<Record<string, { ready: boolean; blockers: string[] }>>({});
  const [accountingReferenceDraft, setAccountingReferenceDraft] = useState("");
  const [packageFormOpen, setPackageFormOpen] = useState<Record<string, boolean>>({});
  const [savingPackageId, setSavingPackageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentRequestKey, setPaymentRequestKey] = useState("");
  const [amendmentsByOrder, setAmendmentsByOrder] = useState<Record<string, Amendment[]>>({});
  const [amendmentReasonDraft, setAmendmentReasonDraft] = useState("");
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceDraft[]>>({});
  const [editingServices, setEditingServices] = useState<Record<string, boolean>>({});
  const [actionSaving, setActionSaving] = useState(false);
  const [fulfillmentByOrder, setFulfillmentByOrder] = useState<Record<string, Fulfillment[]>>({});
  const [fulfillmentDrafts, setFulfillmentDrafts] = useState<Record<string, FulfillmentDraft>>({});
  const [supplierPaymentDrafts, setSupplierPaymentDrafts] = useState<Record<string, SupplierPaymentDraft>>({});
  const [supplierPayables, setSupplierPayables] = useState<SupplierPayable[]>([]);
  const [supplierPayablesLoading, setSupplierPayablesLoading] = useState(false);
  const [supplierPayablesFilter, setSupplierPayablesFilter] = useState("open");
  const [editingFulfillmentId, setEditingFulfillmentId] = useState<string | null>(null);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});

  const canWorkflow = (role: "sales" | "operations" | "accounting") => user?.role === "admin" || (user?.workflowRoles ? user.workflowRoles.includes(role) : true);
  const canManageTravelers = canWorkflow("sales") || canWorkflow("operations");

  const activeView = new URLSearchParams(location.split("?")[1] || "").get("view") || "all";
  const viewLabels: Record<string, string> = {
    all: "Unified orders",
    flight: "Flight orders",
    hotel: "Hotel orders",
    packages: "Packages",
    payments: "Payments",
    accounting: "Accountant queue",
    "supplier-payables": "Supplier invoices",
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
      return;
    }

    if (isAuthenticated) {
      loadOrders();
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const loadOrderPackageSummaries = async (orderId: string) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/orders/${orderId}/packages`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const summaries = Array.isArray(data?.summaries) ? data.summaries : [];
    setPackageSummaries((previous) => ({
      ...previous,
      [orderId]: summaries,
    }));
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load orders");
      }

      const data = await response.json();
      setOrders(data);

      await Promise.allSettled(
        data.map((order: Order) => loadOrderPackageSummaries(order._id))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierPayables = async () => {
    try {
      setSupplierPayablesLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/orders/supplier-payables?status=${supplierPayablesFilter}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw await getApiError(response, "Could not load supplier invoices");
      const data = await response.json();
      setSupplierPayables(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load supplier invoices");
    } finally {
      setSupplierPayablesLoading(false);
    }
  };

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    if (orders.some((order) => order._id === orderId)) return;

    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, { headers: orderHeaders() });
      if (!response.ok) throw await getApiError(response, "Could not load order details");
      const order = await response.json();
      setOrders((current) => [order, ...current.filter((entry) => entry._id !== order._id)]);
      void loadOrderPackageSummaries(orderId);
    } catch (error) {
      setSelectedOrderId(null);
      toast.error(error instanceof Error ? error.message : "Could not load order details");
    }
  };

  useEffect(() => {
    const requestedOrderId = new URLSearchParams(location.split("?")[1] || "").get("orderId");
    if (requestedOrderId && isAuthenticated) {
      void openOrderDetails(requestedOrderId);
    }
  }, [location, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeView === "supplier-payables") {
      void loadSupplierPayables();
    }
  }, [activeView, isAuthenticated, supplierPayablesFilter]);

  const filteredOrders = orders.filter((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const hasProduct = (productType: string) => items.some((item) => item.productType === productType);
    const hasPayment = order.amountPaid > 0 || order.balance < order.customerTotal;
    const matchesView = activeView === "all"
      || (activeView === "flight" && hasProduct("flight"))
      || (activeView === "hotel" && hasProduct("hotel"))
      || activeView === "packages"
      || (activeView === "payments" && hasPayment)
      || (activeView === "accounting" && ["not_ready", "sent", "received"].includes(String(order.accountingStatus || "not_ready")));

    if (!matchesView) return false;

    const term = search.toLowerCase();
    if (!term) return true;

    const summary = packageSummaries[order._id]?.[0];
    return [
      order.orderNumber,
      order.status,
      order.currency,
      String(order.balance),
      summary?.packageName || "",
      summary?.status || "",
      typeof order.customerId === "string" ? order.customerId : (order.customerId.customerName || order.customerId.agencyName || order.customerId.email || ""),
    ].some((value) => value.toLowerCase().includes(term));
  });

  const filteredSupplierPayables = supplierPayables.filter((payable) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const customer = typeof payable.customer === "string"
      ? payable.customer
      : payable.customer.customerName || payable.customer.agencyName || payable.customer.email || payable.customer._id;
    return [
      payable.orderNumber,
      payable.supplierName,
      payable.invoiceReference,
      payable.serviceDescription,
      payable.settlement.status,
      customer,
    ].some((value) => value.toLowerCase().includes(term));
  });

  const selectedOrder = orders.find((order) => order._id === selectedOrderId) || null;
  const selectedFulfillment = selectedOrder ? fulfillmentByOrder[selectedOrder._id] || [] : [];
  const selectedPayments = selectedOrder ? paymentsByOrder[selectedOrder._id] || [] : [];
  const selectedAmendments = selectedOrder ? amendmentsByOrder[selectedOrder._id] || [] : [];
  const customerLabel = (customerId: Order["customerId"]) => typeof customerId === "string"
    ? customerId
    : customerId.customerName || customerId.agencyName || customerId.email || customerId._id;

  const orderHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const recordPayment = async () => {
    if (!selectedOrder || Number(paymentAmount) <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }
    try {
      setActionSaving(true);
      const idempotencyKey = paymentRequestKey || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setPaymentRequestKey(idempotencyKey);
      const response = await fetch(`${API_URL}/api/orders/${selectedOrder._id}/payments`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify({ amount: Number(paymentAmount), currency: selectedOrder.currency, status: "posted", paymentMethod: "manual", paymentReference: paymentReference.trim(), idempotencyKey }),
      });
      if (!response.ok) throw await getApiError(response, "Could not record payment");
      const result = await response.json().catch(() => ({}));
      const savedPayment = result?.payment || result;
      if (result?.duplicate) await loadOrders();
      else setOrders((current) => current.map((order) => order._id === selectedOrder._id
        ? { ...order, amountPaid: order.amountPaid + Number(paymentAmount), balance: Math.max(0, order.balance - Number(paymentAmount)) }
        : order));
      if (paymentFile && savedPayment?._id) {
        const formData = new FormData();
        formData.append("file", paymentFile);
        const token = localStorage.getItem("token");
        const attachmentResponse = await fetch(`${API_URL}/api/orders/${selectedOrder._id}/payments/${savedPayment._id}/attachments`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!attachmentResponse.ok) {
          await loadPayments(selectedOrder._id);
          throw new Error(`Payment was recorded, but its attachment could not be uploaded: ${(await getApiError(attachmentResponse, "Upload failed")).message}`);
        }
      } else if (paymentFile) {
        throw new Error("Payment was recorded, but no payment record was returned for the attachment. Retry with the same amount and reference.");
      }
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentFile(null);
      setPaymentRequestKey("");
      await loadPayments(selectedOrder._id);
      await loadAccountingReadiness(selectedOrder._id);
      toast.success("Payment recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record payment. Retry safely to check the same payment.");
    } finally {
      setActionSaving(false);
    }
  };

  const uploadSupplierInvoice = async (orderId: string, fulfillmentId: string, file: File) => {
    try {
      setActionSaving(true);
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/orders/${orderId}/fulfillment/${fulfillmentId}/invoice-attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) throw await getApiError(response, "Could not upload supplier invoice");
      await loadFulfillment(orderId);
      toast.success("Supplier invoice attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload supplier invoice");
    } finally {
      setActionSaving(false);
    }
  };

  const loadFulfillment = async (orderId: string) => {
    const response = await fetch(`${API_URL}/api/orders/${orderId}/fulfillment`, { headers: orderHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    setFulfillmentByOrder((current) => ({
      ...current,
      [orderId]: Array.isArray(data?.items) ? data.items : [],
    }));
  };

  const loadPayments = async (orderId: string) => {
    const response = await fetch(`${API_URL}/api/orders/${orderId}/payments`, { headers: orderHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    setPaymentsByOrder((current) => ({
      ...current,
      [orderId]: Array.isArray(data?.payments) ? data.payments : [],
    }));
  };

  const updateFulfillmentStatus = async (orderId: string, fulfillmentId: string, status: string) => {
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${orderId}/fulfillment/${fulfillmentId}`, {
        method: "PATCH",
        headers: orderHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw await getApiError(response, "Could not update fulfillment status");
      const updated = await response.json();
      setFulfillmentByOrder((current) => ({
        ...current,
        [orderId]: (current[orderId] || []).map((item) => item._id === updated._id ? updated : item),
      }));
      await loadOrders();
      await loadAccountingReadiness(orderId);
      toast.success("Fulfillment status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update fulfillment status");
    } finally {
      setActionSaving(false);
    }
  };

  const saveFulfillmentDetails = async (orderId: string, fulfillmentId: string) => {
    const draft = fulfillmentDrafts[fulfillmentId];
    if (!draft?.supplierName?.trim()) {
      toast.error("Enter a supplier name");
      return;
    }
    const invoiceAmount = draft.supplierInvoiceAmount.trim();
    if (invoiceAmount && (!Number.isFinite(Number(invoiceAmount)) || Number(invoiceAmount) < 0)) {
      toast.error("Supplier invoice amount must be zero or greater");
      return;
    }
    if (invoiceAmount && !draft.orderItemId) {
      toast.error("Link an order service before entering an invoice amount");
      return;
    }
    if (draft.supplierInvoiceDueAt && !invoiceAmount) {
      toast.error("Enter an invoice amount before setting a due date");
      return;
    }
    if (!draft.orderItemId && draft.supplierInvoiceReference.trim()) {
      toast.error("Link an order service before entering an invoice reference");
      return;
    }
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${orderId}/fulfillment/${fulfillmentId}`, {
        method: "PATCH",
        headers: orderHeaders(),
        body: JSON.stringify({
          supplierName: draft.supplierName.trim(),
          supplierReference: draft.supplierReference?.trim() || "",
          hotelConfirmationNumber: draft.hotelConfirmationNumber?.trim() || "",
          serviceType: draft.serviceType || "other",
          notes: draft.notes?.trim() || "",
          orderItemId: draft.orderItemId || null,
          supplierInvoiceReference: draft.supplierInvoiceReference.trim(),
          supplierInvoiceAmount: invoiceAmount ? Number(invoiceAmount) : null,
          supplierInvoiceDueAt: draft.supplierInvoiceDueAt || null,
        }),
      });
      if (!response.ok) throw await getApiError(response, "Could not save supplier details");
      const updated = await response.json();
      setFulfillmentByOrder((current) => ({
        ...current,
        [orderId]: (current[orderId] || []).map((item) => item._id === updated._id ? updated : item),
      }));
      await loadFulfillment(orderId);
      await loadOrders();
      await loadAccountingReadiness(orderId);
      if (activeView === "supplier-payables") void loadSupplierPayables();
      setEditingFulfillmentId(null);
      toast.success("Supplier details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save supplier details");
    } finally {
      setActionSaving(false);
    }
  };

  const beginFulfillmentEdit = (item: Fulfillment) => {
    setFulfillmentDrafts((drafts) => ({
      ...drafts,
      [item._id]: {
        orderItemId: item.orderItemId || "",
        supplierName: item.supplierName || "",
        supplierReference: item.supplierReference || "",
        hotelConfirmationNumber: item.hotelConfirmationNumber || "",
        supplierInvoiceReference: item.supplierInvoiceReference || "",
        supplierInvoiceAmount: item.supplierInvoiceAmount === undefined ? "" : String(item.supplierInvoiceAmount),
        supplierInvoiceDueAt: item.supplierInvoiceDueAt ? item.supplierInvoiceDueAt.slice(0, 10) : "",
        serviceType: item.serviceType || "other",
        notes: item.notes || "",
      },
    }));
    setEditingFulfillmentId(item._id);
    window.requestAnimationFrame(() => {
      document.getElementById(`fulfillment-${item._id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const recordSupplierPayment = async (orderId: string, fulfillment: Fulfillment) => {
    const draft = supplierPaymentDrafts[fulfillment._id];
    const amount = Number(draft?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a supplier payment greater than zero");
      return;
    }
    const storageKey = `supplier-payment-idempotency:${fulfillment._id}`;
    const idempotencyKey = draft?.requestKey || sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, idempotencyKey);
    setSupplierPaymentDrafts((current) => ({
      ...current,
      [fulfillment._id]: { ...current[fulfillment._id], amount: String(amount), requestKey: idempotencyKey },
    }));
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${orderId}/fulfillment/${fulfillment._id}/supplier-payments`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify({ amount, idempotencyKey, paymentReference: draft?.paymentReference.trim() || "", paymentMethod: "manual" }),
      });
      if (!response.ok) throw await getApiError(response, "Could not record supplier payment");
      const result = await response.json();
      setFulfillmentByOrder((current) => ({
        ...current,
        [orderId]: (current[orderId] || []).map((item) => item._id === fulfillment._id
          ? { ...result.fulfillment, supplierInvoiceSettlement: result.settlement }
          : item),
      }));
      sessionStorage.removeItem(storageKey);
      setSupplierPaymentDrafts((current) => ({ ...current, [fulfillment._id]: { amount: "", paymentReference: "" } }));
      if (activeView === "supplier-payables") void loadSupplierPayables();
      toast.success("Supplier payment recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record supplier payment");
    } finally {
      setActionSaving(false);
    }
  };

  useEffect(() => {
    if (selectedOrderId) {
      void loadFulfillment(selectedOrderId);
      void loadPayments(selectedOrderId);
      void loadAccountingReadiness(selectedOrderId);
      void loadAmendments(selectedOrderId);
    }
  }, [selectedOrderId]);

  const ensurePackageDraft = (orderId: string, existingSummary?: OrderPackageSummary) => {
    setPackageDrafts((previous) => ({
      ...previous,
      [orderId]: {
        packageName: previous[orderId]?.packageName || existingSummary?.packageName || `${orderId.slice(0, 6).toUpperCase()} package`,
        status: previous[orderId]?.status || existingSummary?.status || "draft",
        travelerIds: previous[orderId]?.travelerIds || [],
        items: previous[orderId]?.items || [],
      },
    }));
  };

  const loadPackageEditorData = async (order: Order, summary?: OrderPackageSummary) => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const travelerResponse = await fetch(`${API_URL}/api/orders/${order._id}/travelers`, { headers });
    if (travelerResponse.ok) {
      const travelerData = await travelerResponse.json();
      setTravelers((previous) => ({
        ...previous,
        [order._id]: Array.isArray(travelerData) ? travelerData : [],
      }));
    }

    const customerId = typeof order.customerId === "string" ? order.customerId : order.customerId._id;
    const customerTravelersResponse = await fetch(`${API_URL}/api/customers/${customerId}/travelers`, { headers });
    if (customerTravelersResponse.ok) {
      const customerTravelerData = await customerTravelersResponse.json();
      setCustomerTravelers((previous) => ({
        ...previous,
        [order._id]: Array.isArray(customerTravelerData) ? customerTravelerData : [],
      }));
    } else {
      const body = await customerTravelersResponse.json().catch(() => null);
      toast.error(typeof body?.message === "string" ? body.message : "Could not load this customer's saved travelers");
    }

    if (summary?.packageId) {
      const packageResponse = await fetch(`${API_URL}/api/orders/${order._id}/packages/${summary.packageId}`, { headers });
      if (packageResponse.ok) {
        const packageData = await packageResponse.json();
        const packageRecord = packageData?.package;
        setPackageDrafts((previous) => ({
          ...previous,
          [order._id]: {
            packageName: packageRecord?.packageName || summary.packageName,
            status: packageRecord?.status || summary.status,
            travelerIds: Array.isArray(packageRecord?.travelerIds) ? packageRecord.travelerIds.map(String) : [],
            items: Array.isArray(packageRecord?.items) ? packageRecord.items.map((item: PackageItem) => ({
              title: item.title || "",
              serviceType: item.serviceType || "other",
              startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
              endDate: item.endDate ? String(item.endDate).slice(0, 10) : "",
            })) : [],
          },
        }));
      }
    }
  };

  useEffect(() => {
    if (!selectedOrder || activeView !== "packages") return;
    void loadPackageEditorData(selectedOrder, packageSummaries[selectedOrder._id]?.[0]);
  }, [activeView, selectedOrderId, selectedOrder?._id, packageSummaries[selectedOrder?._id || ""]?.[0]?.packageId]);

  const loadAmendments = async (orderId: string) => {
    const response = await fetch(`${API_URL}/api/orders/${orderId}/amendments`, { headers: orderHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    setAmendmentsByOrder((current) => ({ ...current, [orderId]: Array.isArray(data?.amendments) ? data.amendments : [] }));
  };

  const requestAmendment = async (order: Order) => {
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${order._id}/amendments`, { method: "POST", headers: orderHeaders(), body: JSON.stringify({ reason: amendmentReasonDraft }) });
      if (!response.ok) throw await getApiError(response, "Could not request amendment");
      setAmendmentReasonDraft("");
      await loadAmendments(order._id);
      toast.success("Amendment request sent to accounting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request amendment");
    } finally { setActionSaving(false); }
  };

  const decideAmendment = async (order: Order, amendment: Amendment, decision: "approve" | "reject") => {
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${order._id}/amendments/${amendment._id}/decision`, { method: "POST", headers: orderHeaders(), body: JSON.stringify({ decision }) });
      if (!response.ok) throw await getApiError(response, "Could not update amendment");
      await Promise.all([loadAmendments(order._id), loadOrders()]);
      toast.success(decision === "approve" ? "Sale reopened for an approved amendment" : "Amendment request rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update amendment");
    } finally { setActionSaving(false); }
  };

  const saveServiceChanges = async (order: Order) => {
    const drafts = serviceDrafts[order._id] || [];
    const items = (order.items || []).map((item, index) => ({
      ...item,
      description: drafts[index]?.description ?? String(item.description || "Travel service"),
      quantity: Number(drafts[index]?.quantity ?? item.quantity ?? 1),
      salePrice: Number(drafts[index]?.salePrice ?? item.salePrice ?? 0),
    }));
    const saleSubtotal = items.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.salePrice || 0), 0);
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${order._id}`, { method: "PATCH", headers: orderHeaders(), body: JSON.stringify({ items, saleSubtotal }) });
      if (!response.ok) throw await getApiError(response, "Could not update sale services");
      const updated = await response.json();
      setOrders((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
      setEditingServices((current) => ({ ...current, [order._id]: false }));
      toast.success("Sale services updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update sale services");
    } finally { setActionSaving(false); }
  };

  const loadAccountingReadiness = async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/accounting/readiness`, { headers: orderHeaders() });
      if (!response.ok) throw await getApiError(response, "Could not load accounting checklist");
      const result = await response.json();
      setAccountingReadiness((previous) => ({ ...previous, [orderId]: { ready: Boolean(result.ready), blockers: result.blockers || [] } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load accounting checklist");
    }
  };

  const advanceAccounting = async (order: Order, step: "handoff" | "receive" | "close") => {
    if (step === "receive" && !accountingReferenceDraft.trim()) {
      toast.error("Enter the accounting reference first");
      return;
    }
    try {
      setActionSaving(true);
      const response = await fetch(`${API_URL}/api/orders/${order._id}/accounting/${step}`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify(step === "receive" ? { accountingReference: accountingReferenceDraft.trim() } : {}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.code === "ACCOUNTING_NOT_READY" && Array.isArray(body.blockers)) {
          setAccountingReadiness((previous) => ({ ...previous, [order._id]: { ready: false, blockers: body.blockers } }));
        }
        throw new Error(typeof body?.message === "string" ? body.message : "Could not update accounting status");
      }
      const result = await response.json();
      setOrders((current) => current.map((item) => item._id === order._id ? {
        ...item,
        accountingStatus: result.order.accountingStatus,
        accountingReference: result.order.accountingReference,
      } : item));
      if (step === "receive") setAccountingReferenceDraft("");
      await loadAccountingReadiness(order._id);
      toast.success(step === "handoff" ? "Sale handed to accounting" : step === "receive" ? "Accounting receipt recorded" : "Sale closed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update accounting status");
    } finally {
      setActionSaving(false);
    }
  };

  const addCustomerTravelerToOrder = async (order: Order) => {
    const travelerId = selectedCustomerTraveler[order._id];
    if (!travelerId) {
      toast.error("Select a customer traveler first");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/orders/${order._id}/travelers`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify({ travelerId }),
      });
      if (!response.ok) throw await getApiError(response, "Could not add traveler to order");
      const snapshot = await response.json();
      setTravelers((previous) => ({
        ...previous,
        [order._id]: [snapshot, ...(previous[order._id] || [])],
      }));
      setPackageDrafts((previous) => {
        const draft = previous[order._id];
        return draft ? { ...previous, [order._id]: { ...draft, travelerIds: Array.from(new Set([...draft.travelerIds, snapshot._id])) } } : previous;
      });
      setSelectedCustomerTraveler((previous) => ({ ...previous, [order._id]: "" }));
      await loadOrderPackageSummaries(order._id);
      await loadAccountingReadiness(order._id);
      toast.success("Traveler snapshot added to order");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add traveler to order");
    }
  };

  const saveCustomerTraveler = async (order: Order) => {
    const draft = newTravelerDrafts[order._id] || { firstName: "", lastName: "" };
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error("Enter the traveler's first and last name");
      return;
    }
    const customerId = typeof order.customerId === "string" ? order.customerId : order.customerId._id;
    try {
      const response = await fetch(`${API_URL}/api/customers/${customerId}/travelers`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify({ firstName: draft.firstName.trim(), lastName: draft.lastName.trim() }),
      });
      if (!response.ok) throw await getApiError(response, "Could not save customer traveler");
      const traveler = await response.json();
      const snapshotResponse = await fetch(`${API_URL}/api/orders/${order._id}/travelers`, {
        method: "POST",
        headers: orderHeaders(),
        body: JSON.stringify({ travelerId: traveler._id }),
      });
      if (!snapshotResponse.ok) throw await getApiError(snapshotResponse, "Traveler was saved to the customer but could not be attached to this sale");
      const snapshot = await snapshotResponse.json();
      setCustomerTravelers((previous) => ({
        ...previous,
        [order._id]: [traveler, ...(previous[order._id] || [])],
      }));
      setTravelers((previous) => ({ ...previous, [order._id]: [snapshot, ...(previous[order._id] || [])] }));
      setSelectedCustomerTraveler((previous) => ({ ...previous, [order._id]: "" }));
      await loadOrderPackageSummaries(order._id);
      await loadAccountingReadiness(order._id);
      setNewTravelerDrafts((previous) => ({ ...previous, [order._id]: { firstName: "", lastName: "" } }));
      setShowAddTraveler((previous) => ({ ...previous, [order._id]: false }));
      toast.success("Traveler saved to this customer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save customer traveler");
    }
  };

  const handlePackageSubmit = async (order: Order) => {
    const draft = packageDrafts[order._id] || {
      packageName: `${order.orderNumber} package`,
      status: "draft",
      travelerIds: [],
      items: [],
    };

    const token = localStorage.getItem("token");
    const existingSummary = packageSummaries[order._id]?.[0];
    if (!existingSummary && !draft.packageName.trim()) {
      toast.error("Package name is required");
      return;
    }

    try {
      setSavingPackageId(order._id);

      const response = existingSummary
        ? await fetch(`${API_URL}/api/orders/${order._id}/packages/${existingSummary.packageId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              packageName: draft.packageName,
              status: draft.status,
              travelerIds: draft.travelerIds,
            }),
          })
        : await fetch(`${API_URL}/api/orders/${order._id}/packages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              packageName: draft.packageName,
              status: draft.status,
              travelerIds: draft.travelerIds,
            }),
          });

      if (!response.ok) {
        throw new Error("Failed to save package");
      }

      await loadOrderPackageSummaries(order._id);
      await loadAccountingReadiness(order._id);
      setPackageFormOpen((previous) => ({ ...previous, [order._id]: false }));
      toast.success(existingSummary ? "Package updated" : "Package created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save package");
    } finally {
      setSavingPackageId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-slate-500">Booking desk</div>
            <h1 className="text-2xl font-semibold text-slate-900">{viewLabels[activeView] || viewLabels.all}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeView === "supplier-payables" ? "Search supplier, invoice, or order" : "Search order number or customer"}
              className="w-full md:w-72"
            />
            <Button onClick={() => setLocation("/dashboard")}>Back to boards</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-600">{activeView === "supplier-payables" ? "Supplier invoices" : activeView === "accounting" ? "Sales ready for accountant review" : activeView === "all" ? "Current orders" : "Matching orders"}</div>
            <div className="flex items-center gap-3">
              {activeView === "supplier-payables" && (
                <select
                  value={supplierPayablesFilter}
                  onChange={(event) => setSupplierPayablesFilter(event.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  aria-label="Filter supplier invoices"
                >
                  <option value="open">Open balances</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                  <option value="all">All invoices</option>
                </select>
              )}
              <div className="text-sm text-slate-500">{activeView === "supplier-payables" ? filteredSupplierPayables.length : filteredOrders.length} total</div>
            </div>
          </div>

          {activeView === "supplier-payables" ? (
            supplierPayablesLoading ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">Loading supplier invoices…</div>
            ) : filteredSupplierPayables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">No supplier invoices match this view.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Supplier invoice</th>
                      <th className="px-3 py-2">Order / customer</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Paid</th>
                      <th className="px-3 py-2">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplierPayables.map((payable) => {
                      const customer = typeof payable.customer === "string"
                        ? payable.customer
                        : payable.customer.customerName || payable.customer.agencyName || payable.customer.email || payable.customer._id;
                      const overdue = payable.settlement.status === "overdue";
                      return (
                        <tr key={payable.fulfillmentId} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-3">
                            <button type="button" className="text-left" onClick={() => void openOrderDetails(payable.orderId)}>
                              <div className="font-medium text-slate-900 hover:text-[#2063E9]">{payable.supplierName}</div>
                              <div className="text-xs text-slate-500">{payable.invoiceReference || "Invoice reference not set"}</div>
                              <div className="text-xs text-slate-500">{payable.serviceDescription}</div>
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <button type="button" className="text-left" onClick={() => void openOrderDetails(payable.orderId)}>
                              <div className="font-medium text-slate-800">{payable.orderNumber}</div>
                              <div className="text-xs text-slate-500">{customer}</div>
                            </button>
                          </td>
                          <td className={`px-3 py-3 text-xs ${overdue ? "font-medium text-red-700" : "text-slate-600"}`}>
                            {payable.dueAt ? new Date(payable.dueAt).toLocaleDateString(undefined, { timeZone: "UTC" }) : "No due date"}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-md px-2 py-1 text-xs font-medium ${overdue ? "bg-red-50 text-red-700" : payable.settlement.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {payable.settlement.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{payable.invoiceAmount.toFixed(2)} {payable.currency}</td>
                          <td className="px-3 py-3 text-slate-700">{payable.settlement.paid.toFixed(2)} {payable.currency}</td>
                          <td className={`px-3 py-3 font-medium ${overdue ? "text-red-700" : "text-slate-900"}`}>{payable.settlement.outstanding.toFixed(2)} {payable.currency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              Loading orders…
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              No orders yet. Accept a quotation from a lead to create an order.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    {activeView === "packages" && <th className="px-3 py-2">Package</th>}
                    <th className="px-3 py-2">Status</th>
                    {activeView === "accounting" && <th className="px-3 py-2">Accounting</th>}
                    <th className="px-3 py-2">Customer total</th>
                    <th className="px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Margin</th>
                    <th className="px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const summary = packageSummaries[order._id]?.[0];

                    return (
                      <tr id={`order-row-${order._id}`} key={order._id} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <button type="button" className="text-left" onClick={() => setSelectedOrderId(order._id)}>
                            <div className="font-medium text-slate-900 hover:text-[#2063E9]">{order.orderNumber}</div>
                            <div className="text-xs text-slate-500">View order details</div>
                          </button>
                          <div className="text-xs text-slate-500">{order.currency}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800">{customerLabel(order.customerId)}</div>
                          {typeof order.customerId !== "string" && order.customerId.email && <div className="text-xs text-slate-500">{order.customerId.email}</div>}
                        </td>
                        {activeView === "packages" && <td className="px-3 py-3">
                          {summary ? (
                            <div>
                              <div className="font-medium text-slate-900">{summary.packageName}</div>
                              <div className="text-xs text-slate-500">
                                {summary.status} • {summary.itemCount} services • {summary.travelerCount} travelers
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No package</span>
                          )}

                          {packageFormOpen[order._id] ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <Input
                                value={packageDrafts[order._id]?.packageName || ""}
                                onChange={(event) =>
                                  setPackageDrafts((previous) => ({
                                    ...previous,
                                    [order._id]: {
                                      packageName: event.target.value,
                                      status: previous[order._id]?.status || "draft",
                                      travelerIds: previous[order._id]?.travelerIds || [],
                                      items: previous[order._id]?.items || [],
                                    },
                                  }))
                                }
                                placeholder="Package name"
                                className="h-9"
                              />
                              <select
                                value={packageDrafts[order._id]?.status || "draft"}
                                onChange={(event) =>
                                  setPackageDrafts((previous) => ({
                                    ...previous,
                                    [order._id]: {
                                      packageName: previous[order._id]?.packageName || `${order.orderNumber} package`,
                                      status: event.target.value,
                                      travelerIds: previous[order._id]?.travelerIds || [],
                                      items: previous[order._id]?.items || [],
                                    },
                                  }))
                                }
                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                              >
                                <option value="draft">Draft</option>
                                <option value="ready">Ready</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="in_travel">In travel</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-slate-600">Travelers for {customerLabel(order.customerId)}</div>
                                {(travelers[order._id] || []).length === 0 ? (
                                  <div className="text-xs text-slate-400">No travelers on this order</div>
                                ) : (
                                  (travelers[order._id] || []).map((traveler) => {
                                    const selected = packageDrafts[order._id]?.travelerIds.includes(traveler._id);
                                    return (
                                      <label key={traveler._id} className="flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={(event) =>
                                            setPackageDrafts((previous) => {
                                              const draft = previous[order._id] || {
                                                packageName: `${order.orderNumber} package`,
                                                status: "draft",
                                                travelerIds: [],
                                                items: [],
                                              };
                                              const travelerIds = event.target.checked
                                                ? [...draft.travelerIds, traveler._id]
                                                : draft.travelerIds.filter((id) => id !== traveler._id);
                                              return { ...previous, [order._id]: { ...draft, travelerIds } };
                                            })
                                          }
                                        />
                                        {traveler.firstName} {traveler.lastName}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                                <select
                                  value={selectedCustomerTraveler[order._id] || ""}
                                  onChange={(event) => setSelectedCustomerTraveler((previous) => ({ ...previous, [order._id]: event.target.value }))}
                                  className="h-9 min-w-48 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                                >
                                  <option value="">
                                    {(customerTravelers[order._id] || []).length
                                      ? "Choose a saved customer traveler"
                                      : "No saved customer travelers"}
                                  </option>
                                  {(customerTravelers[order._id] || []).map((traveler) => (
                                    <option key={traveler._id} value={traveler._id}>
                                      {traveler.firstName} {traveler.lastName}
                                    </option>
                                  ))}
                                </select>
                                <Button type="button" size="sm" variant="outline" disabled={!canWorkflow("operations")} onClick={() => void addCustomerTravelerToOrder(order)}>
                                  Add booking snapshot
                                </Button>
                              </div>
                              {!(customerTravelers[order._id] || []).length && (
                                <div className="text-xs text-slate-500">No saved travelers are linked to this customer yet.</div>
                              )}
                              {(showAddTraveler[order._id] || !(customerTravelers[order._id] || []).length) && (
                                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                  <Input
                                    value={newTravelerDrafts[order._id]?.firstName || ""}
                                    onChange={(event) => setNewTravelerDrafts((previous) => ({ ...previous, [order._id]: { firstName: event.target.value, lastName: previous[order._id]?.lastName || "" } }))}
                                    placeholder="First name"
                                    className="h-9"
                                  />
                                  <Input
                                    value={newTravelerDrafts[order._id]?.lastName || ""}
                                    onChange={(event) => setNewTravelerDrafts((previous) => ({ ...previous, [order._id]: { firstName: previous[order._id]?.firstName || "", lastName: event.target.value } }))}
                                    placeholder="Last name"
                                    className="h-9"
                                  />
                                  <Button type="button" size="sm" variant="outline" disabled={!canWorkflow("operations")} onClick={() => void saveCustomerTraveler(order)}>
                                    Save traveler
                                  </Button>
                                </div>
                              )}
                              {!!(customerTravelers[order._id] || []).length && !showAddTraveler[order._id] && (
                                <Button type="button" size="sm" variant="ghost" disabled={!canWorkflow("operations")} className="h-7 px-2 text-xs" onClick={() => setShowAddTraveler((previous) => ({ ...previous, [order._id]: true }))}>
                                  + Save another traveler
                                </Button>
                              )}
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="text-xs font-medium text-slate-600">Services included in this sale</div>
                                <div className="mt-2 space-y-1">
                                  {(order.items || []).map((item, index) => (
                                    <div key={`${order._id}-sale-service-${index}`} className="flex justify-between gap-3 text-xs text-slate-700">
                                      <span>{String(item.description || "Travel service")}</span>
                                      <span>{String(item.productType || "service")}</span>
                                    </div>
                                  ))}
                                  {!(order.items || []).length && <div className="text-xs text-amber-700">No services are on this order yet. Add them to the quotation or sale once; they will appear here.</div>}
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500">This list comes from the order. You don’t need to add the same services again to the package.</div>
                              </div>                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handlePackageSubmit(order)}
                                  disabled={!canWorkflow("operations") || savingPackageId === order._id}
                                >
                                  {savingPackageId === order._id ? "Saving..." : summary ? "Update" : "Create"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPackageFormOpen((previous) => ({ ...previous, [order._id]: false }))}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canWorkflow("operations")}
                                onClick={() => {
                                  ensurePackageDraft(order._id, summary);
                                  void loadPackageEditorData(order, summary);
                                  setPackageFormOpen((previous) => ({ ...previous, [order._id]: true }));
                                }}
                              >
                                {summary ? "Edit package" : "Create package"}
                              </Button>
                            </div>
                          )}
                        </td>}
                        <td className="px-3 py-3 text-slate-700">{order.status}</td>
                        {activeView === "accounting" && <td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-xs font-medium ${order.accountingStatus === "received" ? "bg-indigo-50 text-indigo-700" : order.accountingStatus === "sent" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>{({ not_ready: "Ready to send", sent: "Sent", received: "Received" } as Record<string, string>)[order.accountingStatus || "not_ready"]}</span></td>}
                        <td className="px-3 py-3 text-slate-700">{order.customerTotal.toFixed(2)}</td>
                        <td className="px-3 py-3 text-slate-700">{order.totalCost.toFixed(2)}</td>
                        <td className="px-3 py-3 text-slate-700">{order.grossMargin.toFixed(2)}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">{order.balance.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Order detail</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedOrder.orderNumber}</h2>
                <div className="mt-1 text-sm text-slate-500">Customer {customerLabel(selectedOrder.customerId)} · {selectedOrder.currency}</div>
              </div>
              <div className="flex items-center gap-2">
                {selectedOrder.sourceCardId && selectedOrder.sourceBoardId && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setLocation(`/board/${selectedOrder.sourceBoardId}?card=${selectedOrder.sourceCardId}`)}>Open lead and quotation</Button>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{selectedOrder.status}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrderId(null)}>Close</Button>
              </div>
            </div>

            <div className="mt-4 border-b border-slate-100 pb-4">
              <div className="max-w-2xl rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Record payment</div>
                {canWorkflow("accounting") ? <div className="flex flex-wrap gap-2">
                  <Input type="number" min="0" value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value); setPaymentRequestKey(""); }} placeholder={`Amount in ${selectedOrder.currency}`} className="h-9 min-w-0 flex-1" />
                  <Input value={paymentReference} onChange={(event) => { setPaymentReference(event.target.value); setPaymentRequestKey(""); }} placeholder="Receipt/reference (optional)" className="h-9 min-w-0 flex-1" />
                  <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" aria-label="Payment receipt attachment" className="h-9 min-w-0 flex-1 text-xs" onChange={(event) => setPaymentFile(event.target.files?.[0] || null)} />
                  <Button type="button" size="sm" disabled={actionSaving} onClick={() => void recordPayment()}>Post</Button>
                </div> : <div className="text-xs text-slate-500">Accounting access is required to post customer payments.</div>}
                {paymentFile && <div className="mt-1 text-xs text-slate-500">Receipt: {paymentFile.name}</div>}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Services</div>
                  {canWorkflow("sales") && selectedOrder.accountingStatus !== "sent" && selectedOrder.accountingStatus !== "received" && selectedOrder.accountingStatus !== "closed" && !editingServices[selectedOrder._id] && (selectedOrder.items || []).length > 0 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      setServiceDrafts((current) => ({ ...current, [selectedOrder._id]: (selectedOrder.items || []).map((item) => ({ description: String(item.description || ""), quantity: Number(item.quantity || 1), salePrice: Number(item.salePrice || 0) })) }));
                      setEditingServices((current) => ({ ...current, [selectedOrder._id]: true }));
                    }}>Edit sale details</Button>
                  )}
                </div>
                {editingServices[selectedOrder._id] && (
                  <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <div className="mb-2 text-xs text-slate-600">Update the accepted sale details. Supplier invoice costs are managed in Operations.</div>
                    <div className="space-y-2">
                      {(selectedOrder.items || []).map((item, index) => (
                        <div key={`${selectedOrder._id}-edit-${index}`} className="grid gap-2 sm:grid-cols-[2fr_0.7fr_1fr]">
                          <Input value={serviceDrafts[selectedOrder._id]?.[index]?.description || ""} placeholder="Service" onChange={(event) => setServiceDrafts((current) => ({ ...current, [selectedOrder._id]: (current[selectedOrder._id] || []).map((draft, draftIndex) => draftIndex === index ? { ...draft, description: event.target.value } : draft) }))} />
                          <Input type="number" min="1" step="1" value={serviceDrafts[selectedOrder._id]?.[index]?.quantity ?? 1} aria-label="Quantity" onChange={(event) => setServiceDrafts((current) => ({ ...current, [selectedOrder._id]: (current[selectedOrder._id] || []).map((draft, draftIndex) => draftIndex === index ? { ...draft, quantity: Number(event.target.value) } : draft) }))} />
                          <Input type="number" min="0" step="0.01" value={serviceDrafts[selectedOrder._id]?.[index]?.salePrice ?? 0} aria-label="Selling price per unit" onChange={(event) => setServiceDrafts((current) => ({ ...current, [selectedOrder._id]: (current[selectedOrder._id] || []).map((draft, draftIndex) => draftIndex === index ? { ...draft, salePrice: Number(event.target.value) } : draft) }))} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" disabled={actionSaving} onClick={() => void saveServiceChanges(selectedOrder)}>Save sale details</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingServices((current) => ({ ...current, [selectedOrder._id]: false }))}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {(selectedOrder.items || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No services on this order.</div>
                  ) : (
                    (selectedOrder.items || []).map((item, index) => (
                      <div key={`${selectedOrder._id}-detail-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                        <div>
                          <div className="font-medium text-slate-900">{String(item.description || "Travel service")}</div>
                          <div className="text-xs text-slate-500">{String(item.productType || "other")} · {String(item.status || "draft")}</div>
                        </div>
                        <div className="text-right text-sm font-medium text-slate-800">{Number(item.salePrice || 0).toFixed(2)} {selectedOrder.currency}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-800">Financial summary</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-xs text-slate-500">Customer total</div><div className="font-semibold">{selectedOrder.customerTotal.toFixed(2)}</div></div>
                    <div><div className="text-xs text-slate-500">Paid</div><div className="font-semibold text-emerald-700">{selectedOrder.amountPaid.toFixed(2)}</div></div>
                    <div><div className="text-xs text-slate-500">Balance</div><div className="font-semibold text-amber-700">{selectedOrder.balance.toFixed(2)}</div></div>
                    <div><div className="text-xs text-slate-500">Gross margin</div><div className="font-semibold">{selectedOrder.grossMargin.toFixed(2)}</div></div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</div>
                    {selectedPayments.length === 0 ? <div className="text-xs text-slate-500">No payments recorded.</div> : <div className="space-y-2">{selectedPayments.map((payment) => <div key={payment._id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"><span className="text-slate-500">{payment.paymentMethod || "Payment"}{payment.status ? ` · ${payment.status}` : ""}{payment.paymentReference ? ` · ${payment.paymentReference}` : ""}{payment.createdAt ? ` · ${new Date(payment.createdAt).toLocaleDateString()}` : ""}</span><span className={payment.status === "refunded" ? "font-medium text-red-600" : "font-medium text-emerald-700"}>{payment.status === "refunded" ? "-" : ""}{Number(payment.amount || 0).toFixed(2)} {payment.currency}</span>{payment.attachments?.map((attachment, index) => <a key={attachment._id || `${payment._id}-${index}`} href={orderAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer" className="w-full text-blue-700 underline">Receipt: {attachment.name}</a>)}</div>)}</div>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">Accounting handoff</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {{ not_ready: "Not ready", sent: "Sent", received: "Received", closed: "Closed" }[selectedOrder.accountingStatus || "not_ready"]}
                    </span>
                  </div>
                  {selectedAmendments.some((amendment) => amendment.status === "approved") && selectedOrder.accountingStatus === "not_ready" && (
                    <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-xs text-indigo-800">Accounting approved an amendment. Update the sale details, then complete the checklist and send it back to accounting.</div>
                  )}
                  {accountingReadiness[selectedOrder._id]?.blockers.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
                      {accountingReadiness[selectedOrder._id].blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : accountingReadiness[selectedOrder._id]?.ready ? (
                    <div className="mt-2 text-xs text-emerald-700">The accounting checklist is complete.</div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">Loading accounting checklist…</div>
                  )}
                  {(!selectedOrder.accountingStatus || selectedOrder.accountingStatus === "not_ready") && canWorkflow("sales") && (
                    <Button type="button" size="sm" className="mt-3" disabled={actionSaving || !accountingReadiness[selectedOrder._id]?.ready} onClick={() => void advanceAccounting(selectedOrder, "handoff")}>
                      Send to accounting
                    </Button>
                  )}
                  {selectedOrder.accountingStatus === "sent" && canWorkflow("accounting") && (
                    <div className="mt-3 flex gap-2">
                      <Input value={accountingReferenceDraft} onChange={(event) => setAccountingReferenceDraft(event.target.value)} placeholder="Accounting reference" className="h-9" />
                      <Button type="button" size="sm" disabled={actionSaving || !accountingReferenceDraft.trim()} onClick={() => void advanceAccounting(selectedOrder, "receive")}>Mark received</Button>
                    </div>
                  )}
                  {selectedOrder.accountingStatus === "received" && canWorkflow("accounting") && (
                    <Button type="button" size="sm" className="mt-3" disabled={actionSaving} onClick={() => void advanceAccounting(selectedOrder, "close")}>Close sale</Button>
                  )}
                  {selectedOrder.accountingReference && <div className="mt-2 text-xs text-slate-500">Reference: {selectedOrder.accountingReference}</div>}
                </div>
                {selectedOrder.accountingStatus === "closed" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="text-sm font-semibold text-slate-800">Amend a closed sale</div>
                    <div className="mt-1 text-xs text-slate-600">Sales requests a reason; Accounting must approve before the order can be edited.</div>
                    <div className="mt-3 space-y-2">
                      {selectedAmendments.map((amendment) => (
                        <div key={amendment._id} className="rounded-lg border border-amber-100 bg-white p-3 text-xs">
                          <div className="font-medium text-slate-700">{amendment.status.replaceAll("_", " ")}: {amendment.reason}</div>
                          {amendment.decisionNotes && <div className="mt-1 text-slate-500">{amendment.decisionNotes}</div>}
                          {amendment.status === "requested" && canWorkflow("accounting") && (
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" disabled={actionSaving} onClick={() => void decideAmendment(selectedOrder, amendment, "approve")}>Approve and reopen</Button>
                              <Button size="sm" variant="outline" disabled={actionSaving} onClick={() => void decideAmendment(selectedOrder, amendment, "reject")}>Reject</Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {canWorkflow("sales") && !selectedAmendments.some((amendment) => ["requested", "approved"].includes(amendment.status)) && (
                        <div className="flex flex-wrap gap-2">
                          <Input value={amendmentReasonDraft} onChange={(event) => setAmendmentReasonDraft(event.target.value)} placeholder="Why does this sale need a change?" className="h-9 min-w-0 flex-1" />
                          <Button size="sm" disabled={actionSaving || amendmentReasonDraft.trim().length < 8} onClick={() => void requestAmendment(selectedOrder)}>Request amendment</Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">Travelers on this sale</div>
                    {!canManageTravelers && <span className="text-xs text-slate-500">Sales or Operations role required</span>}
                  </div>
                  <div className="mt-2 space-y-1">
                    {(travelers[selectedOrder._id] || []).map((traveler) => (
                      <div key={traveler._id} className="rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
                        {traveler.firstName} {traveler.lastName}
                      </div>
                    ))}
                    {travelers[selectedOrder._id]?.length === 0 && <div className="text-xs text-amber-700">No traveler attached yet.</div>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={selectedCustomerTraveler[selectedOrder._id] || ""}
                      disabled={!canManageTravelers}
                      onChange={(event) => setSelectedCustomerTraveler((current) => ({ ...current, [selectedOrder._id]: event.target.value }))}
                      className="h-9 min-w-48 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                    >
                      <option value="">{customerTravelers[selectedOrder._id]?.length ? "Choose a traveler" : "No saved travelers"}</option>
                      {(customerTravelers[selectedOrder._id] || []).filter((traveler) => !(travelers[selectedOrder._id] || []).some((attached) => attached.travelerId === traveler._id)).map((traveler) => (
                        <option key={traveler._id} value={traveler._id}>{traveler.firstName} {traveler.lastName}</option>
                      ))}
                    </select>
                    <Button type="button" size="sm" variant="outline" disabled={!canManageTravelers || !selectedCustomerTraveler[selectedOrder._id]} onClick={() => void addCustomerTravelerToOrder(selectedOrder)}>
                      Add traveler
                    </Button>
                  </div>
                  {(showAddTraveler[selectedOrder._id] || !(customerTravelers[selectedOrder._id] || []).length) ? (
                    <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        value={newTravelerDrafts[selectedOrder._id]?.firstName || ""}
                        onChange={(event) => setNewTravelerDrafts((current) => ({ ...current, [selectedOrder._id]: { firstName: event.target.value, lastName: current[selectedOrder._id]?.lastName || "" } }))}
                        placeholder="First name"
                        className="h-9"
                        disabled={!canManageTravelers}
                      />
                      <Input
                        value={newTravelerDrafts[selectedOrder._id]?.lastName || ""}
                        onChange={(event) => setNewTravelerDrafts((current) => ({ ...current, [selectedOrder._id]: { firstName: current[selectedOrder._id]?.firstName || "", lastName: event.target.value } }))}
                        placeholder="Last name"
                        className="h-9"
                        disabled={!canManageTravelers}
                      />
                      <Button type="button" size="sm" variant="outline" disabled={!canManageTravelers} onClick={() => void saveCustomerTraveler(selectedOrder)}>
                        Save & add
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" disabled={!canManageTravelers} onClick={() => setShowAddTraveler((current) => ({ ...current, [selectedOrder._id]: true }))}>
                      + New traveler
                    </Button>
                  )}
                  <div className="mt-2 text-xs text-slate-500">A traveler is required before accounting handoff.</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">Supplier bookings</div>
                  </div>
                  {selectedFulfillment.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">No supplier tasks yet.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedFulfillment.map((item) => (
                        <div id={`fulfillment-${item._id}`} key={item._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800">{item.supplierName || "Supplier"}</div>
                              <div className="text-xs text-slate-500">
                                {item.orderItemId
                                  ? String((selectedOrder.items || []).find((orderItem) => String(orderItem._id || "") === item.orderItemId)?.description || "Linked service")
                                  : "Not linked to an order service"}
                                {item.supplierReference ? ` · Booking ${item.supplierReference}` : item.orderItemId ? " · Booking reference needed" : ""}
                                {item.hotelConfirmationNumber ? ` · Hotel confirmation ${item.hotelConfirmationNumber}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={item.status}
                                disabled={actionSaving}
                                onChange={(event) => void updateFulfillmentStatus(selectedOrder._id, item._id, event.target.value)}
                                className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700"
                              >
                                <option value="pending">Pending</option>
                                <option value="booked">Booked</option>
                                <option value="in_progress">In progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={actionSaving || item.status === "cancelled"}
                                onClick={() => beginFulfillmentEdit(item)}
                              >Edit</Button>
                            </div>
                          </div>
                          {editingFulfillmentId === item._id && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {!item.orderItemId ? (
                              <>
                              <select
                                value={fulfillmentDrafts[item._id]?.orderItemId || ""}
                                disabled={actionSaving}
                                onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], orderItemId: event.target.value } }))}
                                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                              >
                                <option value="">Choose order service</option>
                                {(selectedOrder.items || []).map((orderItem, orderItemIndex) => {
                                  const orderItemId = String(orderItem._id || "");
                                  const otherFulfillment = selectedFulfillment.find((other) => other._id !== item._id && other.status !== "cancelled" && String(other.orderItemId || "") === orderItemId);
                                  const description = String(orderItem.description || `Service ${orderItemIndex + 1}`);
                                  return <option key={orderItemId || orderItemIndex} value={orderItemId} disabled={!orderItemId || Boolean(otherFulfillment)}>{description}{otherFulfillment ? ` · already assigned to ${otherFulfillment.supplierName || "another supplier task"}` : ""}</option>;
                                })}
                              </select>
                              {selectedFulfillment.some((other) => other._id !== item._id && other.status !== "cancelled" && other.orderItemId) && (
                                <div className="sm:col-span-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                                  This service is already assigned to another supplier task. Edit that task to update its supplier details.
                                  <div className="mt-1.5 flex flex-wrap gap-2">
                                    {selectedFulfillment.filter((other) => other._id !== item._id && other.status !== "cancelled" && other.orderItemId).map((other) => {
                                      const linkedService = (selectedOrder.items || []).find((orderItem) => String(orderItem._id || "") === String(other.orderItemId || ""));
                                      return (
                                        <Button key={other._id} type="button" variant="outline" size="sm" disabled={actionSaving || other.status === "cancelled"} onClick={() => beginFulfillmentEdit(other)}>
                                          Edit {String(linkedService?.description || "linked service")} · {other.supplierName || "Supplier task"}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              </>
                              ) : (
                                <div className="sm:col-span-2 rounded-md bg-slate-100 px-2.5 py-2 text-xs text-slate-600">
                                  Service: {String((selectedOrder.items || []).find((orderItem) => String(orderItem._id || "") === item.orderItemId)?.description || "Linked service")}
                                </div>
                              )}
                              <Input value={fulfillmentDrafts[item._id]?.supplierName || ""} placeholder="Supplier name" aria-label="Supplier name" className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], supplierName: event.target.value } }))} />
                              <Input value={fulfillmentDrafts[item._id]?.supplierReference || ""} placeholder="Supplier confirmation / booking reference" aria-label="Supplier confirmation or booking reference" className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], supplierReference: event.target.value } }))} />
                              <Input value={fulfillmentDrafts[item._id]?.hotelConfirmationNumber || ""} placeholder="Hotel confirmation number (optional)" aria-label="Hotel confirmation number" className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], hotelConfirmationNumber: event.target.value } }))} />
                              <Input value={fulfillmentDrafts[item._id]?.supplierInvoiceReference || ""} placeholder="Supplier invoice reference" aria-label="Supplier invoice reference" className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], supplierInvoiceReference: event.target.value } }))} />
                              <Input type="number" min="0" step="0.01" value={fulfillmentDrafts[item._id]?.supplierInvoiceAmount || ""} placeholder={`Actual supplier cost (${selectedOrder.currency})`} aria-label={`Actual supplier cost in ${selectedOrder.currency}`} className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], supplierInvoiceAmount: event.target.value } }))} />
                              <Input type="date" value={fulfillmentDrafts[item._id]?.supplierInvoiceDueAt || ""} aria-label="Supplier invoice due date" className="h-8" onChange={(event) => setFulfillmentDrafts((drafts) => ({ ...drafts, [item._id]: { ...drafts[item._id], supplierInvoiceDueAt: event.target.value } }))} />
                              <div className="sm:col-span-2 rounded-md border border-slate-200 bg-white p-2">
                                <div className="mb-1 text-xs font-medium text-slate-600">Supplier invoice attachment</div>
                                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" aria-label="Attach supplier invoice" className="h-9 text-xs" disabled={actionSaving || (!canWorkflow("operations") && !canWorkflow("accounting"))} onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void uploadSupplierInvoice(selectedOrder._id, item._id, file);
                                  event.target.value = "";
                                }} />
                                {!!item.supplierInvoiceAttachments?.length && <div className="mt-2 space-y-1">{item.supplierInvoiceAttachments.map((attachment, index) => <a key={attachment._id || `${item._id}-invoice-${index}`} href={orderAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 underline">{attachment.name}</a>)}</div>}
                              </div>
                              <div className="flex gap-2 sm:col-span-2">
                                <Button type="button" size="sm" disabled={actionSaving} onClick={() => void saveFulfillmentDetails(selectedOrder._id, item._id)}>Save details</Button>
                                <Button type="button" variant="outline" size="sm" disabled={actionSaving} onClick={() => setEditingFulfillmentId(null)}>Discard</Button>
                              </div>
                            </div>
                          )}
                          {item.orderItemId && (item.supplierInvoiceReference || item.supplierInvoiceAmount !== undefined) && (
                            <div className="mt-2 text-xs text-slate-500">
                              {item.supplierInvoiceReference ? `Invoice ${item.supplierInvoiceReference}` : ""}
                              {item.supplierInvoiceAmount !== undefined ? ` · Actual cost before tax ${Number(item.supplierInvoiceAmount).toFixed(2)} ${selectedOrder.currency}` : ""}
                            </div>
                          )}
                          {item.supplierInvoiceAmount !== undefined && (() => {
                            const paid = item.supplierInvoiceSettlement?.paid ?? (item.supplierPayments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
                            const outstanding = item.supplierInvoiceSettlement?.outstanding ?? Math.max(0, item.supplierInvoiceAmount - paid);
                            const settlementStatus = item.supplierInvoiceSettlement?.status ?? (outstanding === 0 ? "paid" : paid > 0 ? "partially_paid" : "unpaid");
                            return (
                              <div className="mt-3 border-t border-slate-200 pt-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={settlementStatus === "overdue" ? "font-semibold text-red-700" : "font-medium text-slate-600"}>
                                    Invoice settlement · {settlementStatus.replaceAll("_", " ")}
                                    {item.supplierInvoiceDueAt ? ` · Due ${new Date(item.supplierInvoiceDueAt).toLocaleDateString(undefined, { timeZone: "UTC" })}` : ""}
                                  </span>
                                  <span className={settlementStatus === "overdue" ? "font-medium text-red-700" : "text-slate-500"}>Paid {paid.toFixed(2)} · Due {outstanding.toFixed(2)} {selectedOrder.currency}</span>
                                </div>
                                {outstanding > 0 && (
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      type="number"
                                      min="0.01"
                                      max={outstanding}
                                      step="0.01"
                                      value={supplierPaymentDrafts[item._id]?.amount || ""}
                                      placeholder={`Payment up to ${outstanding.toFixed(2)}`}
                                      className="h-8 min-w-0"
                                      disabled={actionSaving}
                                      onChange={(event) => setSupplierPaymentDrafts((current) => ({
                                        ...current,
                                        [item._id]: { amount: event.target.value, paymentReference: current[item._id]?.paymentReference || "" },
                                      }))}
                                    />
                                    <Input
                                      value={supplierPaymentDrafts[item._id]?.paymentReference || ""}
                                      placeholder="Payment reference"
                                      className="h-8 min-w-0"
                                      disabled={actionSaving}
                                      onChange={(event) => setSupplierPaymentDrafts((current) => ({
                                        ...current,
                                        [item._id]: { amount: current[item._id]?.amount || "", paymentReference: event.target.value },
                                      }))}
                                    />
                                    <Button type="button" size="sm" disabled={!canWorkflow("accounting") || actionSaving} onClick={() => void recordSupplierPayment(selectedOrder._id, item)}>Record</Button>
                                  </div>
                                )}
                                {!!item.supplierPayments?.length && (
                                  <div className="mt-2 space-y-1">
                                    {item.supplierPayments.map((payment) => (
                                      <div key={payment._id} className="flex justify-between gap-2 text-[11px] text-slate-500">
                                        <span>{payment.paymentMethod}{payment.paymentReference ? ` · ${payment.paymentReference}` : ""} · {new Date(payment.paidAt).toLocaleDateString()}</span>
                                        <span className="font-medium text-slate-700">{Number(payment.amount).toFixed(2)} {selectedOrder.currency}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
