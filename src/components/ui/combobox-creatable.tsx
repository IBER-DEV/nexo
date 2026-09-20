"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Select con búsqueda que además deja crear una opción nueva escribiéndola.
 *
 * Por qué existe: Empresa/Proceso/Aplicación/Cliente son catálogos que el
 * backend resuelve con get-or-create sin pedir ningún rol especial
 * (`ActivitySerializer._get_or_create_catalog` / `ProjectSerializer._resolve_cliente`)
 * — el mismo camino que ya usa Stakeholder. El backend nunca fue el bloqueo;
 * era que estos cuatro campos usaban un `<Select>` estricto que solo puede
 * ofrecer lo que ya existe. Con la org recién creada (catálogo vacío) eso
 * deja al usuario sin ninguna forma de avanzar salvo ir primero a
 * Configuración → Maestros — este componente cierra ese hueco.
 */
export function ComboboxCreatable({
  value,
  onChange,
  options,
  placeholder,
  emptyValueLabel = "Sin especificar",
  searchPlaceholder = "Buscar o crear…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  emptyValueLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const normalizedQuery = query.trim();
  // Coincidencia exacta (sin distinguir mayúsculas) porque el backend
  // resuelve el catálogo con nombre__iexact — si ya existe "Acme Corp" y el
  // usuario escribe "acme corp", debe seleccionar el existente, no ofrecer
  // "Crear acme corp" y depender de que el backend deduplique después.
  const exactMatch = options.some((o) => o.toLowerCase() === normalizedQuery.toLowerCase());
  const canCreate = normalizedQuery.length > 0 && !exactMatch;

  const select = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="px-2 py-3 text-sm text-muted-foreground">
              Sin resultados.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value={emptyValueLabel} onSelect={() => select("")}>
                <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                <span className="italic text-muted-foreground">{emptyValueLabel}</span>
              </CommandItem>
              {options
                .filter((o) => o.toLowerCase().includes(normalizedQuery.toLowerCase()))
                .map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => select(o)}>
                    <Check className={cn("h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                    {o}
                  </CommandItem>
                ))}
              {canCreate && (
                <CommandItem
                  value={`__create__${normalizedQuery}`}
                  onSelect={() => select(normalizedQuery)}
                >
                  <Plus className="h-4 w-4" />
                  Crear "{normalizedQuery}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
