import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  ImagePlay,
  CalendarRange,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Layers,
  FileText,
  Star,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Project Management",
    description:
      "Centralise every project — timelines, budgets, vendors, and client communications — in one clean workspace.",
  },
  {
    icon: Users,
    title: "Vendor & Quote Management",
    description:
      "Manage your supplier network, compare quotations side-by-side, and track works orders without the spreadsheet chaos.",
  },
  {
    icon: BrainCircuit,
    title: "AI Design Intelligence",
    description:
      "Ask a built-in design assistant powered by Claude. Generate floor plans, elevation drawings, and render briefs in seconds.",
  },
  {
    icon: ImagePlay,
    title: "AI Render Generation",
    description:
      "Turn concepts into photorealistic renders using Gemini. Style presets, reference photos, and one-click refinements included.",
  },
  {
    icon: CalendarRange,
    title: "Gantt Scheduling",
    description:
      "Plan up to 250 tasks with Critical Path analysis and all four dependency types. See exactly what's blocking your project.",
  },
  {
    icon: BookOpen,
    title: "Client Portal",
    description:
      "Give every client a beautiful, read-only window into their project — renders, moodboards, drawings, and schedules.",
  },
  {
    icon: Layers,
    title: "Catalogue & Specifications",
    description:
      "Build a searchable product catalogue with vendor tracking, attributes, and file attachments for every item.",
  },
  {
    icon: FileText,
    title: "SOPs & Meeting Minutes",
    description:
      "Document your studio's processes and keep a searchable record of every client meeting, all in one place.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your workspace",
    description:
      "Sign up in under a minute. Your workspace is ready immediately — no setup calls, no waiting.",
  },
  {
    number: "02",
    title: "Add your team and projects",
    description:
      "Invite designers, project managers, and clients. Create your first project and start adding vendors and tasks.",
  },
  {
    number: "03",
    title: "Design, collaborate, deliver",
    description:
      "Let the AI tools accelerate your creative work while the platform keeps your projects and clients perfectly organised.",
  },
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img src="/logo.png" alt="Olympik Design" className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              Olympik Design
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section
        className="relative pt-16 min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(216, 100%, 12%) 0%, hsl(220, 60%, 20%) 50%, hsl(216, 100%, 18%) 100%)",
        }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Dark wash at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/5 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
          <Badge
            className="mb-6 text-xs px-3 py-1 bg-white/10 text-white border-white/20 no-default-active-elevate"
          >
            Built for interior design studios
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Every project. Every vendor.
            <br />
            <span className="text-blue-300">Every render. One place.</span>
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Olympik Design is the all-in-one studio management platform for interior designers —
            combining project tracking, AI design tools, vendor management, and client portals
            under a single roof.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-900 hover:bg-blue-50 font-semibold px-8"
              onClick={() => navigate("/signup")}
            >
              Start free trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <p className="mt-6 text-sm text-blue-200/70">
            No credit card required to start your free trial.
          </p>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-gray-500">
          {["Project tracking", "Vendor quotes", "AI renders", "Client portals", "Gantt scheduling", "Meeting minutes"].map(item => (
            <span key={item} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-xs bg-blue-50 text-blue-700 border-blue-100 no-default-active-elevate">
              Everything you need
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Your entire studio, organised
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              From the first vendor quote to the final client handover — Olympik Design handles every step of the interior design workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-md border border-gray-100 bg-white hover-elevate"
                >
                  <div className="h-10 w-10 rounded-md bg-blue-50 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id="how-it-works"
        className="py-24 px-6"
        style={{ background: "hsl(220, 6%, 97%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-xs bg-blue-50 text-blue-700 border-blue-100 no-default-active-elevate">
              Simple to start
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Up and running in minutes
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              No lengthy onboarding or implementation project. You're working within minutes of signing up.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(100%-1rem)] w-8 h-px bg-gray-200 z-10" />
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: "hsl(216, 100%, 25%)" }}
                    >
                      {step.number}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI highlight ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-2 border border-gray-100">
            {/* Left: text */}
            <div
              className="p-10 sm:p-14 flex flex-col justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(216, 100%, 14%), hsl(220, 60%, 22%))",
              }}
            >
              <Badge className="mb-6 w-fit text-xs bg-white/10 text-white border-white/20 no-default-active-elevate">
                AI-powered
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                Your AI design partner, always on
              </h2>
              <p className="text-blue-100 text-base leading-relaxed mb-8">
                Ask anything about interior design. Generate floor plans and elevation drawings as
                SVG or DXF — ready to import directly into AutoCAD or SketchUp. Then create
                photorealistic renders with a single prompt.
              </p>
              <ul className="space-y-3 text-sm text-blue-100">
                {[
                  "Floor plans + elevations at 1:50 scale",
                  "DXF export for AutoCAD & SketchUp",
                  "AI renders from Gemini 2.5 Flash",
                  "Attach files — PDF, DXF, OBJ, images",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-300 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: visual placeholder */}
            <div
              className="min-h-64 flex items-center justify-center p-10"
              style={{ background: "hsl(220, 6%, 97%)" }}
            >
              <div className="text-center">
                <div className="h-20 w-20 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                  <BrainCircuit className="h-10 w-10 text-blue-600" />
                </div>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  Generate floor plans, renders, and technical drawings — all from a conversation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="py-24 px-6"
        style={{ background: "hsl(220, 6%, 97%)" }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <Badge className="mb-4 text-xs bg-blue-50 text-blue-700 border-blue-100 no-default-active-elevate">
            Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            We're finalising our plans to make sure they fit studios of every size. Start your free
            trial now — no credit card required.
          </p>

          <div className="rounded-md border border-gray-200 bg-white p-10 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-gray-600 text-lg font-medium max-w-md">
              "All the tools an interior design studio actually needs, finally in one place."
            </p>
            <div className="pt-4 border-t border-gray-100 w-full flex flex-col items-center gap-4">
              <p className="text-sm text-gray-400">Pricing plans coming soon. Free trial available now.</p>
              <Button size="lg" onClick={() => navigate("/signup")}>
                Start your free trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="py-24 px-6"
        style={{
          background: "linear-gradient(135deg, hsl(216, 100%, 12%) 0%, hsl(220, 60%, 20%) 100%)",
        }}
      >
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to run your studio smarter?
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Join interior designers who manage their projects, vendors, and clients with Olympik Design.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-900 hover:bg-blue-50 font-semibold px-8"
              onClick={() => navigate("/signup")}
            >
              Start free trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Olympik Design" className="h-7 w-7 object-contain opacity-80" />
            <span className="text-white font-semibold">Olympik Design</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} Olympik Design. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
