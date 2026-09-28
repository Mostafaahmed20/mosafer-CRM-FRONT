import { useMemo } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, BookOpen, FileText, LifeBuoy, MessageSquareWarning, Settings, ShieldCheck, Ticket } from "lucide-react";

const quickActions = [
  {
    title: "Open tickets inbox",
    description: "Review live requests, ownership, and current queue pressure.",
    path: "/tickets",
    icon: Ticket,
  },
  {
    title: "Open boards",
    description: "Jump into operational boards and update card status or handover state.",
    path: "/dashboard",
    icon: ArrowRight,
  },
  {
    title: "Open settings",
    description: "Manage app behavior, appearance, and customer rules.",
    path: "/workspace/settings",
    icon: Settings,
  },
];

const runbooks = [
  {
    title: "Ticket triage",
    body: "Validate requester, board, priority, supplier state, and due date before assigning or escalating.",
  },
  {
    title: "Escalation handling",
    body: "Use admin tickets, board chat, and handover details together so the next owner inherits full context.",
  },
  {
    title: "Booking issue recovery",
    body: "Check booking ref, supplier confirmation, hotel confirmation, covering services, and payment status before contacting the client.",
  },
];

const supportStats = [
  { label: "Knowledge packs", value: "3" },
  { label: "Core workflows", value: "6" },
  { label: "Response lanes", value: "Boards + inbox" },
];

export default function SupportWorkspace() {
  const [, setLocation] = useLocation();

  const faqItems = useMemo(
    () => [
      {
        id: "faq-1",
        title: "Where should new customer requests start?",
        body: "Use the tickets inbox for review, then open the relevant board when the request needs workflow handling and collaboration.",
      },
      {
        id: "faq-2",
        title: "When should I use board chat vs comments?",
        body: "Use board chat for quick coordination among team members. Use card comments for request-specific updates that should stay attached to that ticket.",
      },
      {
        id: "faq-3",
        title: "What belongs in handover fields?",
        body: "Only the next-shift essentials: what was done, what is pending, blockers, next action, and exact ownership.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Workspace</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102A43]">Support</h1>
                <p className="mt-2 max-w-3xl text-sm text-[#6B7C93]">
                  Centralize runbooks, response guidance, and quick operational links so agents do not have to guess where work should happen.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:w-[460px]">
                {supportStats.map((stat) => (
                  <div key={stat.label} className="rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">{stat.label}</div>
                    <div className="mt-2 text-lg font-semibold text-[#102A43]">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#2063E9]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Runbooks</div>
                  <div className="text-sm text-[#6B7C93]">Operational guidance for the main support workflows.</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {runbooks.map((runbook) => (
                  <div key={runbook.title} className="rounded-[22px] border border-[#D9E5F4] bg-[#FBFDFF] p-4">
                    <div className="text-sm font-semibold text-[#102A43]">{runbook.title}</div>
                    <div className="mt-2 text-sm leading-6 text-[#6B7C93]">{runbook.body}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-[#D9E5F4] bg-[#F8FBFF] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#102A43]">
                  <MessageSquareWarning className="h-4 w-4 text-[#2063E9]" />
                  Common support questions
                </div>
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger>{item.title}</AccordionTrigger>
                      <AccordionContent>{item.body}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF8F6] text-[#0F766E]">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Quick control room</div>
                  <div className="text-sm text-[#6B7C93]">Open the places where support work actually happens.</div>
                </div>
              </div>

              <div className="space-y-3">
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    onClick={() => setLocation(action.path)}
                    className="flex w-full items-start gap-4 rounded-[22px] border border-[#D9E5F4] bg-[#FBFDFF] px-4 py-4 text-left transition hover:border-[#BDD4F7] hover:bg-white"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F4F8FF] text-[#2063E9]">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#102A43]">{action.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[#6B7C93]">{action.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-[#D9E5F4] bg-[#FBFDFF] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#102A43]">
                  <ShieldCheck className="h-4 w-4 text-[#2063E9]" />
                  Support policy baseline
                </div>
                <div className="space-y-3 text-sm leading-6 text-[#6B7C93]">
                  <p>Keep ticket-specific facts inside card details and comments, not only inside chat.</p>
                  <p>Use handover fields when work crosses shifts, not ad-hoc notes in the board title or description.</p>
                  <p>Escalations should preserve booking ref, supplier state, payment status, and next owner before routing onward.</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#829AB1]">
                  <FileText className="h-3.5 w-3.5" />
                  This workspace is now a real support surface, not just a placeholder entry page.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
