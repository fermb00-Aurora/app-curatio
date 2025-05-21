import React from "react";
import { ChartContainer, ChartConfig } from "@/components/ui/chart";

interface ChartWrapperProps {
  chartId: string;
  chartType: string;
  data: any;
  title?: string;
  config?: ChartConfig;
  children: React.ReactNode;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ chartId, chartType, data, title, config = {}, children }) => {
  // You can add more logic here if needed later
  return (
    <ChartContainer id={chartId} config={config}>
      {children}
    </ChartContainer>
  );
};

export default ChartWrapper; 