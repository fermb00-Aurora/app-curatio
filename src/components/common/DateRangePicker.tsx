import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DateRangePickerProps {
  onRangeChange: (range: { from: Date; to: Date }) => void;
}

export function DateRangePicker({ onRangeChange }: DateRangePickerProps) {
  const { t } = useTranslation();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(),
    to: new Date()
  });
  const [isCustom, setIsCustom] = useState(false);

  const handlePresetSelect = (preset: string) => {
    const today = new Date();
    let newRange = { from: today, to: today };

    switch (preset) {
      case "today":
        break;
      case "week":
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        newRange = { from: lastWeek, to: today };
        break;
      case "month":
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        newRange = { from: lastMonth, to: today };
        break;
      case "custom":
        setIsCustom(true);
        setRange({ from: undefined, to: undefined });
        setIsCalendarOpen(true); // Always open calendar when custom is selected
        return;
      default:
        break;
    }

    setRange(newRange);
    onRangeChange(newRange);
    setIsCustom(false);
    setIsCalendarOpen(false);
  };

  const handleCalendarSelect = (selectedRange: any) => {
    if (selectedRange) {
      // Update the range state with the selected dates
      const newRange = { 
        from: selectedRange.from || range.from, 
        to: selectedRange.to || range.to 
      };
      setRange(newRange);
      
      // Only inform about the change but keep the calendar open
      if (selectedRange.from && selectedRange.to) {
        onRangeChange({ 
          from: selectedRange.from, 
          to: selectedRange.to 
        });
      }
    }
  };

  const handleClear = () => {
    const today = new Date();
    setRange({ from: today, to: today });
    setIsCustom(false);
    setIsCalendarOpen(false);
    onRangeChange({ from: today, to: today });
  };

  const displayDate = range.from && range.to
    ? range.from === range.to
      ? format(range.from, "PPP", { locale: es })
      : `${format(range.from, "PPP", { locale: es })} - ${format(range.to, "PPP", { locale: es })}`
    : range.from && !range.to
      ? `${format(range.from, "PPP", { locale: es })} - ${t("dateSelector.selectDate")}`
      : t("dateSelector.selectDate");

  return (
    <div className="w-full space-y-2">
      <div className="text-white text-sm font-medium mb-4">
        {t("dateSelector.selectRange")}
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant="outline"
          onClick={() => handlePresetSelect("today")}
          className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
        >
          {t("dateSelector.today")}
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePresetSelect("week")}
          className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
        >
          {t("dateSelector.lastWeek")}
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePresetSelect("month")}
          className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
        >
          {t("dateSelector.lastMonth")}
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePresetSelect("custom")}
          className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
        >
          {t("dateSelector.custom")}
        </Button>
      </div>

      {isCustom && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                "bg-sidebar-accent text-sidebar-foreground border-sidebar-border",
                "hover:bg-sidebar-accent/80"
              )}
              onClick={() => setIsCalendarOpen(true)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {displayDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 bg-sidebar border-sidebar-border shadow-lg" 
            align="start"
            forceMount
          >
            <Calendar
              mode="range"
              selected={{
                from: range.from,
                to: range.to
              }}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              initialFocus
              className="p-3 pointer-events-auto bg-sidebar text-sidebar-foreground rounded-md"
            />
          </PopoverContent>
        </Popover>
      )}
      
      <Button
        variant="ghost"
        onClick={handleClear}
        className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
      >
        <X className="mr-2 h-4 w-4" />
        {t("dateSelector.removeFilter")}
      </Button>
    </div>
  );
}
