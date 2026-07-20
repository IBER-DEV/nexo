import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Lenis from "lenis";

import landingCss from "../styles/landing.css?url";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import BoardSimulator from "@/components/landing/BoardSimulator";
import RoleSelector from "@/components/landing/RoleSelector";
import NexoEngine from "@/components/landing/NexoEngine";
import Roadmap from "@/components/landing/Roadmap";
import Pricing from "@/components/landing/Pricing";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import { NexoGradientDefs } from "@/components/landing/NexoBrandMark";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Nexo — gestión de actividades para equipos de TI, open source" },
      {
        name: "description",
        content:
          "Backlog, planeación, Kanban y reportes con flujos configurables por organización: elige una plantilla, ajusta estados y prioridades, e invita a tu equipo con un código de acceso. Crea tu espacio en minutos. Open source bajo AGPL-3.0, autoalojable con Docker.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Outfit:wght@400;500;600;700;800;900&family=Fira+Code:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: landingCss },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  // Buttery-smooth scroll interpolation (lerp: 0.1, duration: 1.5)
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, duration: 1.5 });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Route in-page anchors through Lenis for smooth jumps
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: id === "#top" ? 0 : -8 });
    };
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="landing-root">
      <NexoGradientDefs />
      <Navbar />
      {/* Content slides over the sticky terminal footer (z-index reveal) */}
      <main className="relative z-10 bg-ink shadow-[0_60px_120px_rgba(0,0,0,0.85)]">
        <Hero />
        <BoardSimulator />
        <RoleSelector />
        <NexoEngine />
        <Roadmap />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
