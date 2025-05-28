import React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "../../lib/utils";
import { useDataContext } from "@/contexts/DataContext";

export interface DateRangeSelectorProps {
  onChange: (range: { from: Date; to: Date }) => void;
}

export function DateRangeSelector({ onChange }: DateRangeSelectorProps) {
  const { t } = useTranslation();
  const { dataStore } = useDataContext();
  const [isCustomRange, setIsCustomRange] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [range, setRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(),
    to: new Date()
  });

  const handlePresetSelect = (value: string) => {
    const today = new Date();
    let newRange = { from: today, to: today };

    switch (value) {
      case "today":
        break;
      case "week": {
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        newRange = { from: lastWeek, to: today };
        break;
      }
      case "month": {
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        newRange = { from: lastMonth, to: today };
        break;
      }
      case "custom":
        setIsCustomRange(true);
        setRange({ from: undefined, to: undefined });
        setIsCalendarOpen(true); // Always open calendar when custom is selected
        return;
      default:
        break;
    }

    setRange(newRange);
    onChange(newRange);
    setIsCustomRange(false);
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
        onChange({ 
          from: selectedRange.from, 
          to: selectedRange.to 
        });
      }
    }
  };

  const handleRemoveFilter = () => {
    const today = new Date();
    const newRange = { from: today, to: today };
    setRange(newRange);
    onChange(newRange);
    setIsCustomRange(false);
    setIsCalendarOpen(false);
  };

  const displayDate = range.from && range.to
    ? `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`
    : range.from && !range.to
      ? `${format(range.from, "dd/MM/yyyy")} - ${t("dateSelector.selectDate")}`
      : t("dateSelector.selectDate");

  const disabledDays = React.useCallback((date: Date) => {
    if (!dataStore.availableDates.length) return false;
    
    return !dataStore.availableDates.some(availableDate => 
      availableDate.getDate() === date.getDate() &&
      availableDate.getMonth() === date.getMonth() &&
      availableDate.getFullYear() === date.getFullYear()
    );
  }, [dataStore.availableDates]);

  return (
    <div className="flex flex-col space-y-2">
      <Select
        onValueChange={handlePresetSelect}
        defaultValue="today"
      >
        <SelectTrigger className="w-full bg-white text-gray-900">
          <SelectValue placeholder={t("dateSelector.selectRange")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{t("dateSelector.today")}</SelectItem>
          <SelectItem value="week">{t("dateSelector.lastWeek")}</SelectItem>
          <SelectItem value="month">{t("dateSelector.lastMonth")}</SelectItem>
          <SelectItem value="custom">{t("dateSelector.custom")}</SelectItem>
        </SelectContent>
      </Select>

      {isCustomRange && (
        <div className="w-full">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-white text-gray-900",
                  !range && "text-muted-foreground"
                )}
                onClick={() => setIsCalendarOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayDate}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 bg-white shadow-lg border border-gray-200" 
              align="start"
              side="bottom"
              sideOffset={5}
              alignOffset={0}
              forceMount
            >
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={range.from}
                selected={{
                  from: range.from,
                  to: range.to
                }}
                onSelect={handleCalendarSelect}
                disabled={disabledDays}
                numberOfMonths={1}
                className="bg-white"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemoveFilter}
        className="w-full justify-start text-gray-400 hover:text-gray-600"
      >
        <X className="mr-2 h-4 w-4" />
        {t("dateSelector.removeFilter")}
      </Button>
    </div>
  );
}
