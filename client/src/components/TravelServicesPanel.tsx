import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TravelService, TravelServiceType, travelServiceApi } from "@/lib/api";

const serviceTypes: TravelServiceType[] = ["Flight", "Hotel", "Transfer", "Tour", "Activity", "Transportation", "Visa", "Insurance", "Guide", "Cruise", "Other"];
const API_URL = import.meta.env.VITE_API_URL || "";

type CustomerOption = { _id: string; agencyName: string; customerName?: string };

export function TravelServicesPanel({ boardId, requestId, onConvertToOrder }: { boardId: string; requestId: string; onConvertToOrder?: (customerId?: string) => Promise<void> }) {
  const [services, setServices] = useState<TravelService[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<TravelServiceType>("Flight");
  const [title, setTitle] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [netCost, setNetCost] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  const load = () => travelServiceApi.list(boardId, requestId).then(setServices).catch(() => toast.error("Could not load travel services"));
  useEffect(() => {
    void load();
    const token = localStorage.getItem("token");
    void fetch(`${API_URL}/api/customers`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]));
  }, [boardId, requestId]);

  const totals = useMemo(() => services.reduce((sum, service) => ({ net: sum.net + service.netCost, sale: sum.sale + service.sellingPrice }), { net: 0, sale: 0 }), [services]);
  const profit = totals.sale - totals.net;

  const addService = async () => {
    if (!title.trim()) return toast.error("Enter a service name");
    setSaving(true);
    try {
      const service = await travelServiceApi.create(boardId, requestId, {
        type, title: title.trim(), supplierName: supplierName.trim(), pricingSource: "", supplierReference: "",
        currency, netCost: Math.max(0, Number(netCost) || 0), sellingPrice: Math.max(0, Number(sellingPrice) || 0),
        status: "Requested", details: {}, notes: "",
      });
      setServices((current) => [...current, service]);
      setTitle(""); setSupplierName(""); setNetCost("0"); setSellingPrice("0");
      toast.success("Travel service added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add service"); }
    finally { setSaving(false); }
  };

  const removeService = async (serviceId: string) => {
    try { await travelServiceApi.remove(boardId, requestId, serviceId); setServices((current) => current.filter((service) => service._id !== serviceId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove service"); }
  };

  return <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Travel services</h3>
          <p className="mt-0.5 max-w-md text-sm leading-5 text-slate-500">Add flights, hotels, tours, and transfers to this request.</p>
        </div>
        {onConvertToOrder && services.length > 0 && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px] sm:items-end">
            <select aria-label="Customer for new order" value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 sm:max-w-[220px]">
              <option value="">Use matching customer</option>
              {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.customerName || customer.agencyName}</option>)}
            </select>
            <Button type="button" variant="outline" className="h-9 w-full whitespace-nowrap sm:w-auto" onClick={() => void onConvertToOrder(customerId || undefined)}>
              Convert to order
            </Button>
          </div>
        )}
      </div>
    </div>
    <div className="bg-slate-50/70 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">Service type<select value={type} onChange={(e) => setType(e.target.value as TravelServiceType)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">{serviceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Currency<Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="mt-1.5 h-10 bg-white px-3" /></label>
        <label className="sm:col-span-2 text-xs font-medium text-slate-600">Service name<Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 h-10 bg-white px-3" placeholder="e.g. Istanbul flight" /></label>
        <label className="sm:col-span-2 text-xs font-medium text-slate-600">Supplier <span className="font-normal text-slate-400">(optional)</span><Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="mt-1.5 h-10 bg-white px-3" placeholder="Supplier or pricing source" /></label>
        <label className="text-xs font-medium text-slate-600">Net cost<Input type="number" min="0" value={netCost} onChange={(e) => setNetCost(e.target.value)} className="mt-1.5 h-10 bg-white px-3" /></label>
        <label className="text-xs font-medium text-slate-600">Selling price<Input type="number" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="mt-1.5 h-10 bg-white px-3" /></label>
        <Button type="button" className="mt-1 h-10 sm:col-span-2" disabled={saving} onClick={addService}><Plus className="mr-1.5 h-4 w-4" />Add travel service</Button>
      </div>
      <div className="mt-5 space-y-2">
        {services.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No services yet. Add flights, hotels, tours, or transfers to build this request.</p> : services.map((service) => <div key={service._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"><div className="min-w-0"><div className="font-medium text-slate-800">{service.type} · {service.title}</div><div className="text-xs text-slate-500">{service.supplierName || "No supplier"} · Net {service.netCost.toFixed(2)} / Sell {service.sellingPrice.toFixed(2)} {service.currency}</div></div><div className="flex items-center gap-2"><span className="text-right text-xs font-semibold text-emerald-700">+{service.profit.toFixed(2)}<br />{service.marginPercent.toFixed(1)}%</span><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => removeService(service._id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
      <div className="mt-5 grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"><div><span className="block text-xs text-slate-500">Net cost</span><strong>{totals.net.toFixed(2)}</strong></div><div><span className="block text-xs text-slate-500">Selling</span><strong>{totals.sale.toFixed(2)}</strong></div><div><span className="block text-xs text-slate-500">Expected profit</span><strong className={profit >= 0 ? "text-emerald-700" : "text-red-600"}>{profit.toFixed(2)}</strong></div></div>
    </div>
  </section>;
}
