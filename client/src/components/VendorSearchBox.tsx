import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, X, Wallet, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Vendor } from "@shared/schema";

export function VendorSearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filtered = query.trim().length === 0
    ? []
    : vendors
        .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function goTo(path: string) {
    setQuery("");
    setOpen(false);
    navigate(path);
  }

  return (
    <div ref={containerRef} className="relative w-48 sm:w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search vendors..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (query) setOpen(true); }}
          className="pl-8 pr-7 h-8 text-sm bg-muted/50 border-border/60 focus:bg-background"
          data-testid="input-global-vendor-search"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(""); setOpen(false); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-72 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
            Vendors
          </div>
          {filtered.map((vendor) => (
            <div key={vendor.id} className="border-b border-border/50 last:border-0">
              <div className="px-3 pt-2 pb-1">
                <p className="text-sm font-medium text-foreground truncate">{vendor.name}</p>
                {vendor.contactPerson && (
                  <p className="text-xs text-muted-foreground truncate">{vendor.contactPerson}</p>
                )}
              </div>
              <div className="flex gap-1 px-3 pb-2">
                <button
                  type="button"
                  onClick={() => goTo(`/accounts?vendorId=${vendor.id}`)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm bg-muted hover-elevate text-foreground font-medium"
                >
                  <Wallet className="h-3 w-3" />
                  Accounts
                </button>
                <button
                  type="button"
                  onClick={() => goTo(`/vendors`)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm bg-muted hover-elevate text-foreground font-medium"
                >
                  <Users className="h-3 w-3" />
                  Vendors
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && query.trim() && (
            <div className="px-3 py-3 text-sm text-muted-foreground">No vendors found</div>
          )}
        </div>
      )}
      {open && filtered.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-72 bg-popover border border-border rounded-md shadow-lg">
          <div className="px-3 py-3 text-sm text-muted-foreground">No vendors found</div>
        </div>
      )}
    </div>
  );
}
