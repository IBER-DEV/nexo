import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Github, Rocket } from "lucide-react";
import { EASE } from "./anim";
import { NEXO_REPO_URL, NexoBrandMark } from "./NexoBrandMark";

const LINKS = [
  { label: "Funciones", href: "#features" },
  { label: "Demo interactiva", href: "#demo" },
  { label: "Motor", href: "#engine" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Precios", href: "#pricing" },
];

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      className="glass-nav fixed inset-x-0 top-0 z-50"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface">
            <NexoBrandMark className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            NEXO
            <span className="ml-2 hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400 sm:inline-block">
              open source
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-gray-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={NEXO_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="group hidden items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3.5 py-1.5 text-sm text-gray-300 transition-all duration-300 hover:border-gray-600 hover:text-white sm:flex"
          >
            <Github className="h-4 w-4" />
            <span>Ver en GitHub</span>
          </a>
          <Link
            to="/login"
            className="hidden rounded-full px-3.5 py-1.5 text-sm text-gray-300 transition-colors duration-300 hover:text-white sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/signup"
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_0_28px_-4px_rgba(52,211,153,0.7)]"
          >
            <Rocket className="h-4 w-4" />
            Crear cuenta
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
