import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerProfile, customerApi, Quotation, QuotationLine, quotationApi } from "@/lib/api";

const emptyLine = (): QuotationLine => ({
  serviceType: "Flight", description: "", supplierName: "", quantity: 1, netRate: 0, sellingRate: 0,
});

export function QuotationEditor({ boardId, requestId, agencyName, onClientAccepted }: { boardId: string; requestId: string; agencyName?: string; onClientAccepted?: (customerId: string) => Promise<void> }) {
  const [lines, setLines] = useState<QuotationLine[]>([emptyLine()]);
  const [currency, setCurrency] = useState("USD");
  const [version, setVersion] = useState<number | null>(null);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);

  useEffect(() => {
    let active = true;
    customerApi.getAll(boardId)
      .then((profiles) => {
        if (!active) return;
        setCustomers(profiles);
        const matched = profiles.find((profile) => profile.agencyName.trim().toLowerCase() === String(agencyName || "").trim().toLowerCase());
        if (matched) setCustomerId(matched._id);
      })
      .catch(() => active && toast.error("Could not load customer profiles"))
      .finally(() => active && setCustomersLoading(false));
    return () => { active = false; };
  }, [agencyName, boardId]);

  useEffect(() => {
    let active = true;
    quotationApi.list(boardId, requestId)
      .then((quotes) => {
        if (!active || !quotes[0]) return;
        setActiveQuotation(quotes[0]);
        setVersion(quotes[0].version);
        setCurrency(quotes[0].currency);
        setLines(quotes[0].lines.length ? quotes[0].lines : [emptyLine()]);
      })
      .catch(() => active && toast.error("Could not load quotations"));
    return () => { active = false; };
  }, [boardId, requestId]);

  const totals = useMemo(() => lines.reduce((sum, line) => {
    const quantity = Number(line.quantity || 0);
    return {
      net: sum.net + quantity * Number(line.netRate || 0),
      sale: sum.sale + quantity * Number(line.sellingRate || 0),
    };
  }, { net: 0, sale: 0 }), [lines]);
  const profit = totals.sale - totals.net;
  const margin = totals.sale ? (profit / totals.sale) * 100 : 0;
  const editing = !activeQuotation || activeQuotation.status === "Draft";

  const updateLine = <K extends keyof QuotationLine>(index: number, key: K, value: QuotationLine[K]) =>
    setLines((current) => current.map((line, i) => i === index ? { ...line, [key]: value } : line));

  const saveVersion = async () => {
    if (!lines.some((line) => line.description.trim())) {
      toast.error("Add a description for at least one service");
      return;
    }
    setSaving(true);
    try {
      const quote = activeQuotation?.status === "Draft"
        ? await quotationApi.update(boardId, requestId, activeQuotation._id, { currency, lines })
        : await quotationApi.create(boardId, requestId, { currency, lines });
      setActiveQuotation(quote);
      setVersion(quote.version);
      toast.success(`Quotation v${quote.version} saved as draft`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save quotation");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: "Sent" | "Accepted") => {
    if (!activeQuotation) return;
    setSaving(true);
    try {
      const updated = await quotationApi.update(boardId, requestId, activeQuotation._id, { status });
      setActiveQuotation(updated);
      if (status === "Sent") {
        toast.success("Quotation marked as sent. Send it to the client in your chat app.");
      } else {
        toast.success("Client confirmation recorded. Create the sale when you are ready.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update quotation status");
    } finally {
      setSaving(false);
    }
  };

  const createOrderFromAcceptedQuote = async () => {
    if (!customerId) {
      toast.error("Choose a customer profile before creating the order");
      return;
    }
    setSaving(true);
    try {
      const result = await quotationApi.convertToOrder(boardId, requestId, activeQuotation?._id || "", customerId);
      await onClientAccepted?.(customerId);
      toast.success(result.duplicate ? "Sale already exists; opened for accounting." : `Sale ${result.order.orderNumber} created for accounting.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">Quotation {version ? `v${version}` : "draft"}</h3>
            {activeQuotation && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{activeQuotation.status}</span>}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">One simple document for the client: supplier net, client selling price, and profit.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input disabled={!editing} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="h-9 w-16 bg-white px-2 text-xs" />
          <Button type="button" size="sm" variant="outline" className="h-9" disabled={!editing} onClick={() => setLines((current) => [...current, emptyLine()])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Line
          </Button>
        </div>
      </div>
      <div className="space-y-3 bg-slate-50/70 p-5">
        <label className="block text-xs font-medium text-slate-600">Customer profile
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={customersLoading || saving} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="">{customersLoading ? "Loading customers..." : "Choose a customer for this sale"}</option>
            {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.agencyName}</option>)}
          </select>
          {!customersLoading && customers.length === 0 && <span className="mt-1 block font-normal text-amber-700">Create a customer profile in Customers first.</span>}
        </label>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="text-xs font-medium text-slate-600">Service
              <select disabled={!editing} value={line.serviceType} onChange={(e) => updateLine(index, "serviceType", e.target.value as QuotationLine["serviceType"])} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
                {["Flight", "Hotel", "Tour", "Transfer", "Other"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Description
              <Input disabled={!editing} value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} className="mt-1.5 h-10 bg-white px-3" placeholder="Service description" />
            </label>
            <label className="text-xs font-medium text-slate-600">Supplier
              <Input disabled={!editing} value={line.supplierName || ""} onChange={(e) => updateLine(index, "supplierName", e.target.value)} className="mt-1.5 h-10 bg-white px-3" placeholder="Supplier name" />
            </label>
            <label className="text-xs font-medium text-slate-600">Quantity
              <Input disabled={!editing} type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, "quantity", Math.max(1, Number(e.target.value || 1)))} className="mt-1.5 h-10 bg-white px-3" />
            </label>
            <label className="text-xs font-medium text-slate-600">Net rate
              <Input disabled={!editing} type="number" min="0" step="0.01" value={line.netRate} onChange={(e) => updateLine(index, "netRate", Math.max(0, Number(e.target.value || 0)))} className="mt-1.5 h-10 bg-white px-3" />
            </label>
            <label className="text-xs font-medium text-slate-600">Sell rate
              <Input disabled={!editing} type="number" min="0" step="0.01" value={line.sellingRate} onChange={(e) => updateLine(index, "sellingRate", Math.max(0, Number(e.target.value || 0)))} className="mt-1.5 h-10 bg-white px-3" />
            </label>
            <Button type="button" size="icon" variant="ghost" disabled={!editing || lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="h-10 w-10 self-end text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div><span className="block text-xs text-slate-500">Net total</span><strong>{totals.net.toFixed(2)} {currency}</strong></div>
          <div><span className="block text-xs text-slate-500">Client price</span><strong>{totals.sale.toFixed(2)} {currency}</strong></div>
          <div><span className="block text-xs text-slate-500">Profit</span><strong className={profit >= 0 ? "text-emerald-700" : "text-red-600"}>{profit.toFixed(2)} {currency}</strong></div>
          <div><span className="block text-xs text-slate-500">Profit margin</span><strong className={profit >= 0 ? "text-emerald-700" : "text-red-600"}>{margin.toFixed(1)}%</strong></div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {activeQuotation && !editing && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setActiveQuotation(null)}>New version</Button>}
          {editing && <Button type="button" size="sm" disabled={saving} onClick={saveVersion}>{saving ? "Saving..." : activeQuotation ? "Save draft" : "Save quotation"}</Button>}
          {activeQuotation?.status === "Draft" && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void updateStatus("Sent")}>Mark sent</Button>}
          {activeQuotation?.status === "Sent" && <Button type="button" size="sm" disabled={saving} onClick={() => void updateStatus("Accepted")}>Client confirmed</Button>}
          {activeQuotation?.status === "Accepted" && <Button type="button" size="sm" disabled={saving || customersLoading || !customerId} onClick={() => void createOrderFromAcceptedQuote()}>{saving ? "Creating sale..." : "Create sale for accounting"}</Button>}
        </div>
      </div>
    </section>
  );
}
