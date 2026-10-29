import type { Metadata } from "next";
import { StatsView } from "@/features/statistics/StatsView";

export const metadata: Metadata = { title: "Statistics" };

export default function StatsPage() {
  return <StatsView />;
}
