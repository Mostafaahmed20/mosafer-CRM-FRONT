import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Layers, Users, Zap, ArrowRight, CheckCircle2, BarChart3, Shield, Target, FileText } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Target,
    title: "Pipeline Management",
    description: "Visualize your sales pipeline with customizable boards. Drag deals between stages and never lose track of an opportunity.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Assign tasks, leave comments, and share files. Keep your entire team aligned with real-time updates.",
  },
  {
    icon: BarChart3,
    title: "Deal Tracking",
    description: "Set due dates, track progress with checklists, and label priorities. Close deals faster with organized workflows.",
  },
];

const benefits = [
  "Unlimited pipelines & cards",
  "Real-time team collaboration",
  "Due dates & reminders",
  "Labels & priority tracking",
  "Activity & comment history",
  "File attachments & media",
];

export default function Home() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-[#0F172A] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">TaskFlow <span className="text-indigo-400 font-medium text-sm">CRM</span></span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <Button
              variant="ghost"
              onClick={() => navigate("/tools/hotel-quote")}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Hotel Quote Tool
            </Button>
            {isAuthenticated ? (
              <Button
                onClick={() => navigate("/tickets")}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/25"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="text-slate-300 hover:text-white hover:bg-white/10"
                >
                  Log in
                </Button>
                <Button
                  onClick={() => navigate("/register")}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/25"
                >
                  Start free
                </Button>
              </>
            )}
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#0F172A] pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-indigo-500/20">
                <Zap className="w-3.5 h-3.5" />
                Built for modern teams
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-6">
                Manage your pipeline,{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  close more deals
                </span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-lg leading-relaxed">
                TaskFlow CRM gives your team the boards, lists, and cards to organize every deal,
                track every task, and collaborate without missing a beat.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-8 h-12 text-base shadow-lg shadow-indigo-500/25"
                >
                  Get started free <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white h-12 text-base"
                >
                  See how it works
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* CRM Board Preview */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 shadow-2xl shadow-indigo-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <span className="text-white/60 text-xs ml-2 font-medium">Sales Pipeline Q1</span>
                </div>
                <div className="flex gap-3 overflow-hidden">
                  {/* List 1 */}
                  <div className="bg-white rounded-xl p-3 w-44 flex-shrink-0">
                    <h4 className="text-xs font-bold text-slate-800 mb-2.5 uppercase tracking-wide">Leads</h4>
                    <div className="space-y-2">
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <div className="flex gap-1 mb-1.5">
                          <span className="w-8 h-1.5 rounded-full bg-emerald-400"></span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">Acme Corp deal</p>
                        <p className="text-[10px] text-slate-400 mt-1">$24,000</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <p className="text-xs text-slate-700 font-medium">New prospect</p>
                        <p className="text-[10px] text-slate-400 mt-1">$8,500</p>
                      </div>
                    </div>
                  </div>

                  {/* List 2 */}
                  <div className="bg-white rounded-xl p-3 w-44 flex-shrink-0">
                    <h4 className="text-xs font-bold text-slate-800 mb-2.5 uppercase tracking-wide">In Progress</h4>
                    <div className="space-y-2">
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <div className="flex gap-1 mb-1.5">
                          <span className="w-8 h-1.5 rounded-full bg-indigo-400"></span>
                          <span className="w-8 h-1.5 rounded-full bg-amber-400"></span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">Enterprise plan</p>
                        <p className="text-[10px] text-slate-400 mt-1">$56,000</p>
                      </div>
                    </div>
                  </div>

                  {/* List 3 */}
                  <div className="bg-white rounded-xl p-3 w-44 flex-shrink-0">
                    <h4 className="text-xs font-bold text-slate-800 mb-2.5 uppercase tracking-wide">Closed Won</h4>
                    <div className="space-y-2">
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <div className="flex gap-1 mb-1.5">
                          <span className="w-8 h-1.5 rounded-full bg-emerald-400"></span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">Annual contract</p>
                        <p className="text-[10px] text-slate-400 mt-1">$120,000</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-4">
              Everything you need to close deals faster
            </h2>
            <p className="text-[#475569] max-w-2xl mx-auto text-lg">
              From lead to close, TaskFlow CRM keeps your pipeline moving with boards, cards, and automation that just works.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 border border-[#E2E8F0] hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mb-6 group-hover:from-indigo-100 group-hover:to-violet-100 transition-colors">
                  <feature.icon className="w-7 h-7 text-[#6366F1]" />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-3">{feature.title}</h3>
                <p className="text-[#475569] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 text-[#6366F1] font-semibold mb-4 text-sm uppercase tracking-wide">
                <Zap className="w-4 h-4" />
                Why TaskFlow CRM?
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-6">
                One platform to manage your entire workflow
              </h2>
              <p className="text-[#475569] mb-8 text-lg leading-relaxed">
                Whether you're managing a sales pipeline, tracking customer relationships, or organizing team projects,
                TaskFlow CRM adapts to how you work.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[#0F172A] text-sm font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Stats Card */}
              <div className="bg-[#0F172A] rounded-2xl p-8 shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-6">Your team's performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-extrabold text-white">142</p>
                    <p className="text-sm text-slate-400 mt-1">Active deals</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-extrabold text-emerald-400">$2.4M</p>
                    <p className="text-sm text-slate-400 mt-1">Pipeline value</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-extrabold text-indigo-400">89%</p>
                    <p className="text-sm text-slate-400 mt-1">Win rate</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-extrabold text-amber-400">12</p>
                    <p className="text-sm text-slate-400 mt-1">Team members</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#6366F1] to-[#7C3AED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/20">
              <Shield className="w-4 h-4" />
              Trusted by growing teams
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
              Ready to streamline your workflow?
            </h2>
            <p className="text-indigo-100 max-w-2xl mx-auto text-lg mb-10">
              Join thousands of teams using TaskFlow CRM to manage their pipeline and close more deals.
            </p>
            <Button
              size="lg"
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")}
              className="bg-white text-[#6366F1] hover:bg-slate-100 px-10 h-14 text-lg font-semibold shadow-lg"
            >
              Get started for free
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">TaskFlow <span className="text-indigo-400 font-medium text-sm">CRM</span></span>
            </div>
            <p className="text-slate-500 text-sm">
              TaskFlow CRM. Built with React & Node.js
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
