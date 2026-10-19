import { Select } from "./ui/kit";
import { useMeData, usePortfolio } from "./session";

export function PortfolioSelect() {
  const me = useMeData();
  const { portfolioId, setPortfolioId } = usePortfolio();
  return (
    <Select value={portfolioId ?? ""} onChange={(e) => setPortfolioId(e.target.value ? Number(e.target.value) : null)} className="h-12 w-60 text-[16px] text-ink">
      <option value="">All Properties</option>
      {me.portfolios.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
