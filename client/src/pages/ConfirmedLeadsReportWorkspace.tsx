import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SidebarRail from "@/components/SidebarRail";
import { useAuth } from "@/contexts/AuthContext";
import { canManageGlobalUsers } from "@/lib/authz";
import { adminReportsApi, ConfirmedLeadReportRow, ConfirmedLeadsReportResponse } from "@/lib/api";
import { ArrowDownToLine, ChevronDown, ExternalLink, Loader2, Printer, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function money(value: number, currency = "USD") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function printableDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function printableText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function printableRows(row: ConfirmedLeadReportRow) {
  if (row.services.length) return row.services;
  return [{ type: "Service", title: serviceText(row), supplierName: row.lead.supplierName || "", quantity: 1, netCost: row.financials.netCost, sellingPrice: row.financials.sellingPrice, currency: row.financials.currency }];
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function serviceText(row: ConfirmedLeadReportRow) {
  if (row.quotation?.lines?.length) {
    return row.quotation.lines.map((line) => `${String(line.serviceType || "Service")}: ${String(line.description || "")}`).join(" | ");
  }
  return (row.lead.travelServices || []).join(", ") || row.lead.leadNeed || "—";
}

function flattenReport(rows: ConfirmedLeadReportRow[]) {
  const output: unknown[][] = [[
    "Lead ID", "Lead title", "Created", "Agent", "Agent email", "Board", "List", "Client name", "Customer / agency", "Client phone", "Client email", "Client country", "Client location", "Requester", "Source", "Type", "Sales stage", "Status", "Qualification", "Need", "Budget", "Travel dates", "Destination", "Traveler names", "Traveler phones", "Service type", "Service description", "Supplier", "Quantity", "Unit net cost", "Unit selling price", "Total net cost", "Total selling price", "Revenue / profit", "Revenue without VAT (15%)", "Paid", "Refunded", "Pending", "Remaining", "Currency", "Payment status", "Booking reference", "Hotel", "Supplier confirmation", "Hotel confirmation", "Voucher", "Check-in", "Check-out", "Arrival", "Quotation version", "Quotation status", "Order number", "Order status", "Accounting status", "Payment references", "Proof attachments", "Follow-up at", "Follow-up channel", "Follow-up note", "Accounting reference", "Accounting notes",
  ]];
  for (const row of rows) {
    const lead = row.lead;
    const order = row.order || {};
    const paymentReferences = row.payments.map((payment) => payment.paymentReference).filter(Boolean).join(" | ");
    const proofAttachments = row.payments.flatMap((payment) => payment.attachments.map((attachment) => attachment.url)).filter(Boolean).join(" | ");
    const services = row.services.length ? row.services : [{ type: "", title: serviceText(row), supplierName: lead.supplierName || "", quantity: 1, netCost: row.financials.netCost, sellingPrice: row.financials.sellingPrice, currency: row.financials.currency }];
    services.forEach((service, index) => {
      const quantity = Math.max(1, Number(service.quantity || 1));
      const net = Number(service.netCost || 0) * quantity;
      const selling = Number(service.sellingPrice || 0) * quantity;
      const revenue = selling - net;
      output.push([
        lead._id, lead.title, formatDate(lead.createdAt), row.agent.username, row.agent.email || "", row.board?.title || "", row.list?.title || "",
        row.customer.name || lead.requester || lead.agencyName || "", row.customer.agencyName || lead.agencyName || "", row.customer.phone || "", row.customer.email || "", row.customer.country || "", row.customer.location || "", lead.requester || "",
        lead.source || "", lead.type || "", lead.salesStage || "", lead.status || "", lead.qualificationStatus || "", lead.leadNeed || "", lead.leadBudget || "", lead.travelDates || "", lead.destination || "",
        row.travelers.map((traveler) => `${traveler.firstName} ${traveler.lastName}`.trim()).join(" | "), row.travelers.map((traveler) => traveler.phone || "").filter(Boolean).join(" | "),
        service.type || "", service.title || "", service.supplierName || "", quantity, Number(service.netCost || 0), Number(service.sellingPrice || 0), net, selling, revenue, revenue / 1.15,
        index === 0 ? row.financials.paid : "", index === 0 ? row.financials.refunded : "", index === 0 ? row.financials.pending : "", index === 0 ? row.financials.balance : "", service.currency || row.financials.currency, row.financials.paymentStatus,
        lead.bookingRef || "", lead.hotelName || "", lead.supplierConfirmationNumber || "", lead.hotelConfirmationNumber || "", lead.voucherNumber || "", lead.checkInDate || "", lead.checkOutDate || "", lead.arrivalDate || "",
        row.quotation?.version || "", row.quotation?.status || "", order.orderNumber || "", order.status || "", order.accountingStatus || lead.accountingStatus || "", paymentReferences, proofAttachments, lead.followUpAt || "", lead.followUpChannel || "", lead.followUpNote || "", lead.accountingReference || order.accountingReference || "", lead.accountingNotes || order.accountingNotes || "",
      ]);
    });
  }
  const totalsByCurrency = new Map<string, { net: number; selling: number; revenue: number; revenueWithoutVat: number; paid: number; remaining: number }>();
  for (const row of rows) {
    const currency = row.financials.currency;
    const totals = totalsByCurrency.get(currency) || { net: 0, selling: 0, revenue: 0, revenueWithoutVat: 0, paid: 0, remaining: 0 };
    totals.net += row.financials.netCost;
    totals.selling += row.financials.sellingPrice;
    totals.revenue += row.financials.profit;
    totals.revenueWithoutVat += row.financials.revenueWithoutVat;
    totals.paid += row.financials.paid;
    totals.remaining += row.financials.balance;
    totalsByCurrency.set(currency, totals);
  }
  totalsByCurrency.forEach((totals, currency) => {
    const totalRow: unknown[] = Array(output[0].length).fill("");
    totalRow[0] = `TOTAL (${currency})`;
    totalRow[output[0].indexOf("Total net cost")] = totals.net;
    totalRow[output[0].indexOf("Total selling price")] = totals.selling;
    totalRow[output[0].indexOf("Revenue / profit")] = totals.revenue;
    totalRow[output[0].indexOf("Revenue without VAT (15%)")] = totals.revenueWithoutVat;
    totalRow[output[0].indexOf("Paid")] = totals.paid;
    totalRow[output[0].indexOf("Remaining")] = totals.remaining;
    output.push(totalRow);
  });
  return output;
}

function ReportRow({ row }: { row: ConfirmedLeadReportRow }) {
  const [open, setOpen] = useState(false);
  const lead = row.lead;
  const order = row.order || {};
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button type="button" onClick={() => setOpen((value) => !value)} className="grid w-full grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_minmax(210px,1.5fr)_minmax(210px,1.5fr)_32px] items-center gap-3 px-4 py-4 text-left hover:bg-slate-50">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{lead.title || "Untitled lead"}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{lead.agencyName || lead.requester || "No customer name"} · {lead.bookingRef || "No booking ref"}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-800">{row.agent.username}</div>
          <div className="mt-1 text-xs text-slate-500">{formatDate(lead.createdAt)}</div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-700">{serviceText(row)}</div>
          <div className="mt-1 text-xs text-slate-500">{row.board?.title || "No board"} / {row.list?.title || "No list"}</div>
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{lead.salesStage || "Won"}</span>
            <span className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-700">{row.financials.paymentStatus}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{money(row.financials.profit, row.financials.currency)} profit</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 bg-slate-50/70 px-4 pb-5 pt-1">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Client price", money(row.financials.sellingPrice, row.financials.currency)],
              ["Supplier net", money(row.financials.netCost, row.financials.currency)],
              ["Profit / margin", `${money(row.financials.profit, row.financials.currency)} · ${row.financials.marginPercent.toFixed(1)}%`],
              ["Paid / balance", `${money(row.financials.paid, row.financials.currency)} / ${money(row.financials.balance, row.financials.currency)}`],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Lead and customer</h3>
              <dl className="mt-3 space-y-2 text-xs text-slate-600">
                <div><dt className="inline font-semibold text-slate-800">Client: </dt><dd className="inline">{row.customer.name || lead.requester || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Agency: </dt><dd className="inline">{row.customer.agencyName || lead.agencyName || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Contact: </dt><dd className="inline">{row.customer.phone || "No phone"} · {row.customer.email || "No email"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Location: </dt><dd className="inline">{[row.customer.location, row.customer.country].filter(Boolean).join(", ") || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Need: </dt><dd className="inline">{lead.leadNeed || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Destination / dates: </dt><dd className="inline">{lead.destination || "—"} / {lead.travelDates || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Travelers: </dt><dd className="inline">{lead.travelerCount || 0}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Follow-up: </dt><dd className="inline">{formatDate(lead.followUpAt)} · {lead.followUpChannel || "—"} · {lead.followUpNote || "—"}</dd></div>
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Booking and quotation</h3>
              <dl className="mt-3 space-y-2 text-xs text-slate-600">
                <div><dt className="inline font-semibold text-slate-800">Booking / voucher: </dt><dd className="inline">{lead.bookingRef || "—"} / {lead.voucherNumber || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Supplier / hotel: </dt><dd className="inline">{lead.supplierName || "—"} / {lead.hotelName || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Confirmations: </dt><dd className="inline">{lead.supplierConfirmationNumber || "—"} / {lead.hotelConfirmationNumber || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Travel dates: </dt><dd className="inline">{lead.checkInDate || lead.arrivalDate || "—"} → {lead.checkOutDate || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Quote: </dt><dd className="inline">v{row.quotation?.version || "—"} · {row.quotation?.status || "No quote"}</dd></div>
              </dl>
              {row.quotation?.lines?.length ? <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">{row.quotation.lines.map((line, index) => <div key={index} className="flex justify-between gap-3"><span>{String(line.description || line.serviceType || "Service")} × {String(line.quantity || 1)}</span><span className="font-medium">{String(line.netRate || 0)} / {String(line.sellingRate || 0)} {row.quotation?.currency}</span></div>)}</div> : null}
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Order, payment, and proof</h3>
              <dl className="mt-3 space-y-2 text-xs text-slate-600">
                <div><dt className="inline font-semibold text-slate-800">Order: </dt><dd className="inline">{order.orderNumber || "Not created"} · {order.status || "—"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Accounting: </dt><dd className="inline">{order.accountingStatus || lead.accountingStatus || "—"} · {lead.accountingReference || order.accountingReference || "No reference"}</dd></div>
                <div><dt className="inline font-semibold text-slate-800">Payment records: </dt><dd className="inline">{row.payments.length}</dd></div>
              </dl>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">{row.payments.length ? row.payments.map((payment) => <div key={payment._id} className="rounded-lg bg-slate-50 p-2"><div className="font-medium text-slate-800">{money(payment.amount, payment.currency)} · {payment.status} · {payment.paymentReference || "No reference"}</div>{payment.attachments.map((attachment, index) => <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-blue-700 hover:underline"><ExternalLink className="h-3 w-3" />{attachment.name}</a>)}</div>) : <span className="text-slate-500">No payment or proof uploaded yet.</span>}</div>
            </section>
          </div>
          {row.services.length > 0 && <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Sale breakdown</h3>
            <table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr>{["Service", "Supplier", "Qty", "Unit cost", "Unit price", "Total cost", "Total price", "Profit", "Profit excl. VAT"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{row.services.map((service, index) => {
              const quantity = Math.max(1, Number(service.quantity || 1));
              const cost = Number(service.netCost || 0) * quantity;
              const price = Number(service.sellingPrice || 0) * quantity;
              const profit = price - cost;
              return <tr key={`${service.title}-${index}`} className="border-t border-slate-100"><td className="px-2 py-2">{service.title || service.type}</td><td className="px-2 py-2">{service.supplierName || "—"}</td><td className="px-2 py-2">{quantity}</td><td className="px-2 py-2">{Number(service.netCost || 0).toFixed(2)}</td><td className="px-2 py-2">{Number(service.sellingPrice || 0).toFixed(2)}</td><td className="px-2 py-2">{cost.toFixed(2)}</td><td className="px-2 py-2">{price.toFixed(2)}</td><td className="px-2 py-2">{profit.toFixed(2)}</td><td className="px-2 py-2">{(profit / 1.15).toFixed(2)}</td></tr>;
            })}</tbody><tfoot><tr className="border-t-2 border-amber-500 bg-slate-200 font-semibold"><td className="px-2 py-2" colSpan={5}>TOTAL ({row.financials.currency})</td><td className="px-2 py-2">{row.financials.netCost.toFixed(2)}</td><td className="px-2 py-2">{row.financials.sellingPrice.toFixed(2)}</td><td className="px-2 py-2">{row.financials.profit.toFixed(2)}</td><td className="px-2 py-2">{row.financials.revenueWithoutVat.toFixed(2)}</td></tr></tfoot></table>
          </section>}
          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Show full record data</summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(row, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default function ConfirmedLeadsReportWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [report, setReport] = useState<ConfirmedLeadsReportResponse | null>(null);
  const [rows, setRows] = useState<ConfirmedLeadReportRow[]>([]);
  const [agentId, setAgentId] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { q: query.trim(), agentId, dateFrom, dateTo, limit: 200 };
      const first = await adminReportsApi.getConfirmedLeads(filters);
      let allRows = [...first.items];
      let page = first.pagination.page;
      while (first.pagination.hasNext && page < first.pagination.totalPages) {
        page += 1;
        const next = await adminReportsApi.getConfirmedLeads({ ...filters, page });
        allRows = allRows.concat(next.items);
      }
      setRows(allRows);
      setReport(first);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load confirmed leads report");
    } finally {
      setLoading(false);
    }
  }, [agentId, dateFrom, dateTo, query]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !canManageGlobalUsers(user)) setLocation("/dashboard");
  }, [authLoading, isAuthenticated, setLocation, user]);

  useEffect(() => {
    if (isAuthenticated && canManageGlobalUsers(user)) void loadReport();
  }, [isAuthenticated, loadReport, user]);

  const summary = report?.summary || { confirmedLeads: 0, sellingPrice: 0, netCost: 0, profit: 0, revenueWithoutVat: 0, paid: 0, balance: 0 };
  const agents = report?.agents || [];
  const byAgent = useMemo(() => report?.byAgent || [], [report]);
  const moneyByCurrency = (key: "sellingPrice" | "netCost" | "profit" | "revenueWithoutVat" | "paid" | "balance") =>
    report?.currencyTotals?.length
      ? report.currencyTotals.map((total) => money(total[key], total.currency)).join(" · ")
      : money(0);

  const exportReport = () => {
    if (!rows.length) return;
    const suffix = agentId ? agents.find((agent) => agent._id === agentId)?.username || "agent" : "all-agents";
    downloadCsv(`confirmed-leads-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`, flattenReport(rows));
    toast.success("Confirmed leads CSV downloaded");
  };

  const exportPdf = () => {
    if (rows.length) window.print();
  };

  const selectedAgent = agentId ? agents.find((agent) => agent._id === agentId)?.username : "All agents";

  if (authLoading || !isAuthenticated || !canManageGlobalUsers(user)) return null;

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] text-slate-900">
      <SidebarRail />
      <main className="min-h-screen min-w-0 flex-1 overflow-x-hidden px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1600px]">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2063E9]">Admin report</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Confirmed leads by agent</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Review every confirmed lead, compare agents, verify selling price and profit, and check payment proof from one report.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void loadReport()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
              <Button variant="outline" onClick={exportPdf} disabled={loading || !rows.length}><Printer className="mr-2 h-4 w-4" />Export PDF</Button>
              <Button onClick={exportReport} disabled={loading || !rows.length} className="bg-[#2063E9] text-white hover:bg-[#164FC0]"><ArrowDownToLine className="mr-2 h-4 w-4" />Export CSV</Button>
            </div>
          </header>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {[
              ["Confirmed leads", summary.confirmedLeads.toLocaleString(), "text-slate-900"],
              ["Selling price", moneyByCurrency("sellingPrice"), "text-blue-700"],
              ["Supplier net", moneyByCurrency("netCost"), "text-slate-700"],
              ["Profit", moneyByCurrency("profit"), "text-emerald-700"],
              ["Profit without VAT", moneyByCurrency("revenueWithoutVat"), "text-emerald-700"],
              ["Paid", moneyByCurrency("paid"), "text-indigo-700"],
              ["Balance", moneyByCurrency("balance"), "text-amber-700"],
            ].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-xl font-semibold ${color}`}>{value}</div></div>)}
          </section>

          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><SlidersHorizontal className="h-4 w-4 text-[#2063E9]" />Report filters</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_160px_160px_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadReport()} placeholder="Search lead, customer, PNR, destination..." className="pl-9" /></div>
              <select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"><option value="">All agents</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.username}{agent.email ? ` · ${agent.email}` : ""}</option>)}</select>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="From date" />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="To date" />
              <Button onClick={() => void loadReport()} disabled={loading}>{loading ? "Loading..." : "Apply filters"}</Button>
            </div>
          </section>

          <section className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-semibold text-slate-900">Agent comparison</h2><p className="mt-1 text-xs text-slate-500">Confirmed leads and financial totals in the current filter.</p></div><span className="text-xs text-slate-500">{byAgent.length} agents</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Agent</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3">Leads</th><th className="px-4 py-3">Selling price</th><th className="px-4 py-3">Net cost</th><th className="px-4 py-3">Profit</th><th className="px-4 py-3">Profit excl. VAT</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">{byAgent.map((agent) => <tr key={`${agent.agentId || "unassigned"}-${agent.currency}`}><td className="px-4 py-3 font-medium text-slate-900">{agent.username}</td><td className="px-4 py-3 text-slate-700">{agent.currency}</td><td className="px-4 py-3 text-slate-700">{agent.leads}</td><td className="px-4 py-3 text-slate-700">{money(agent.sellingPrice, agent.currency)}</td><td className="px-4 py-3 text-slate-700">{money(agent.netCost, agent.currency)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(agent.profit, agent.currency)}</td><td className="px-4 py-3 text-emerald-700">{money(agent.revenueWithoutVat, agent.currency)}</td><td className="px-4 py-3 text-indigo-700">{money(agent.paid, agent.currency)}</td><td className="px-4 py-3 text-amber-700">{money(agent.balance, agent.currency)}</td></tr>)}{!byAgent.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No confirmed leads found.</td></tr>}</tbody></table></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4"><h2 className="font-semibold text-slate-900">Confirmed lead details</h2><p className="mt-1 text-xs text-slate-500">{rows.length} records loaded · click a row to see all customer, booking, quote, payment, and proof data.</p></div>
            {loading ? <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading confirmed leads...</div> : rows.length ? <div className="overflow-x-auto"><div className="min-w-[1000px]">{rows.map((row) => <ReportRow key={row.lead._id} row={row} />)}</div></div> : <div className="px-4 py-16 text-center text-sm text-slate-500">No confirmed leads match the selected filters.</div>}
          </section>
        </div>
      </main>
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media screen { #confirmed-leads-pdf { display: none; } }
        @media print {
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          #confirmed-leads-pdf, #confirmed-leads-pdf * { visibility: visible !important; }
          #confirmed-leads-pdf { display: block !important; position: absolute; inset: 0; width: 100%; color: #263746; font: 9px Arial, sans-serif; }
          #confirmed-leads-pdf .pdf-page { page-break-after: always; }
          #confirmed-leads-pdf .pdf-page:last-child { page-break-after: auto; }
          #confirmed-leads-pdf table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          #confirmed-leads-pdf thead { display: table-header-group; }
          #confirmed-leads-pdf tr { break-inside: avoid; }
          #confirmed-leads-pdf th, #confirmed-leads-pdf td { border: 1px solid #687276; padding: 5px 4px; text-align: center; overflow-wrap: anywhere; }
          #confirmed-leads-pdf th { background: #c3cdd4 !important; border-top: 2px solid #aa8c00; border-bottom: 2px solid #aa8c00; color: #4d5a60; font-weight: 700; }
          #confirmed-leads-pdf .pdf-total td { background: #c3cdd4 !important; border-top: 2px solid #aa8c00; border-bottom: 2px solid #aa8c00; font-weight: 700; }
        }
      `}</style>
      <section id="confirmed-leads-pdf" aria-hidden="true">
        {rows.map((row, rowIndex) => {
          const lead = row.lead;
          const order = row.order || {};
          const customerName = row.customer.name || row.customer.agencyName || lead.requester || lead.agencyName;
          const services = printableRows(row);
          const guests = row.travelers.map((traveler) => `${traveler.firstName} ${traveler.lastName}`.trim()).filter(Boolean).join(", ");
          const currency = row.financials.currency || services[0]?.currency || "USD";
          return <div className="pdf-page" key={lead._id}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", minHeight: 95, marginBottom: 18 }}>
              <div style={{ width: 105, height: 90, background: "#061827", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 700, fontSize: 15, letterSpacing: 1 }}><span><span style={{ color: "#d8a62a", fontSize: 24 }}>M</span><br />MANARA<br />TOURS</span></div>
              <div style={{ width: "48%", borderBottom: "1px solid #cbd0d0", paddingBottom: 8 }}>
                <div style={{ color: "#a58800", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Confirmed Sale Report</div>
                <div style={{ color: "#a58800", fontSize: 19, fontWeight: 700 }}>Manara Tours</div>
                <div>Agent: {printableText(row.agent.username)}</div>
                <div>Generated: {printableDate(new Date().toISOString())}</div>
              </div>
            </header>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, minHeight: 74, margin: "0 3px 14px" }}>
              <div><div>Client: <strong>{printableText(customerName)}</strong></div><div>Phone: {printableText(row.customer.phone)}</div><div>Email: {printableText(row.customer.email)}</div></div>
              <div><div>Order / Booking: <strong>{printableText(order.orderNumber || lead.bookingRef)}</strong></div><div>Destination: {printableText(lead.destination)}</div><div>Travel dates: {printableText(lead.travelDates)}</div></div>
              <div><div>Created: {printableDate(lead.createdAt)}</div><div>Guests: {printableText(guests, `${lead.travelerCount || 0}`)}</div><div>Agent: {printableText(row.agent.username)}</div></div>
            </div>
            <table>
              <thead><tr>{["SN", "RSV #", "SERVICE / HOTEL", "TRAVEL DATES", "TYPE", "SUPPLIER", "CLIENT / GUEST", "QTY", "UNIT COST", "UNIT PRICE", "TOTAL COST", "TOTAL PRICE", "PROFIT", "PAID", "REMAINING"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {services.map((service, serviceIndex) => {
                  const quantity = Math.max(1, Number(service.quantity || 1));
                  const cost = Number(service.netCost || 0) * quantity;
                  const price = Number(service.sellingPrice || 0) * quantity;
                  return <tr key={`${lead._id}-${serviceIndex}`}>
                    <td>{rowIndex + 1}.{serviceIndex + 1}</td><td>{printableText(lead.bookingRef || order.orderNumber)}</td>
                    <td>{printableText(service.title || service.type || lead.hotelName || lead.leadNeed)}</td>
                    <td>{printableText(lead.travelDates || `${lead.checkInDate || ""} - ${lead.checkOutDate || ""}`)}</td>
                    <td>{printableText(service.type)}</td><td>{printableText(service.supplierName || lead.supplierName)}</td>
                    <td>{printableText(serviceIndex === 0 ? (guests || customerName) : "")}</td><td>{quantity}</td>
                    <td>{Number(service.netCost || 0).toFixed(2)}</td><td>{Number(service.sellingPrice || 0).toFixed(2)}</td>
                    <td>{cost.toFixed(2)}</td><td>{price.toFixed(2)}</td><td>{(price - cost).toFixed(2)}</td>
                    <td>{serviceIndex === 0 ? Number(row.financials.paid || 0).toFixed(2) : ""}</td><td>{serviceIndex === 0 ? Number(row.financials.balance || 0).toFixed(2) : ""}</td>
                  </tr>;
                })}
                <tr className="pdf-total"><td colSpan={8}>TOTAL ({currency})</td><td></td><td></td><td>{Number(row.financials.netCost || 0).toFixed(2)}</td><td>{Number(row.financials.sellingPrice || 0).toFixed(2)}</td><td>{Number(row.financials.sellingPrice - row.financials.netCost).toFixed(2)}</td><td>{Number(row.financials.paid || 0).toFixed(2)}</td><td>{Number(row.financials.balance || 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
            <footer style={{ marginTop: 11, display: "flex", justifyContent: "space-between", color: "#52616b" }}><span>{rowIndex + 1} / {rows.length} · {printableText(selectedAgent)}</span><strong>Profit = total selling price − total cost</strong></footer>
          </div>;
        })}
      </section>
    </div>
  );
}
