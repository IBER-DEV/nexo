import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { EASE, fadeUp } from "./anim";

const QUESTIONS = [
  {
    q: "¿AGPL me obliga a publicar mi código?",
    a: "Solo si ofreces Nexo modificado como servicio a terceros por red — en ese caso, sí debes publicar tus modificaciones bajo la misma licencia. Usarlo internamente en tu empresa, sin modificarlo o modificándolo solo para uso interno, no te obliga a nada.",
  },
  {
    q: "¿Puedo exportar mis datos?",
    a: "Sí, en cualquier momento. Es tu base de datos Postgres — no hay formato propietario ni feature flag que la bloquee en la versión self-hosted.",
  },
  {
    q: "¿Qué pasa si dejan de mantenerlo?",
    a: "El código es tuyo. Es open source bajo AGPL-3.0: puedes seguir corriéndolo, forkearlo o contratar a quien quieras para mantenerlo — no dependes de que el proyecto original siga activo.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative overflow-hidden bg-surface py-20 md:py-28">
      <div className="relative mx-auto max-w-2xl px-5 md:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
            {"// preguntas frecuentes"}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Antes de que preguntes
          </h2>
        </motion.div>

        <div className="mt-10 space-y-3">
          {QUESTIONS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.4 }}
                custom={i + 1}
                className="overflow-hidden rounded-xl border border-hairline bg-ink"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-gray-200">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 text-sm leading-relaxed text-gray-400">{item.a}</p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
