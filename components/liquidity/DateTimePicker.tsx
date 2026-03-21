import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

interface DateTimePickerProps {
    value: Date;
    onChange: (date: Date) => void;
    inline?: boolean;
    hideTime?: boolean;
}

export function DateTimePicker({ value, onChange, inline, hideTime }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value);

    const [hours, setHours] = useState(value.getUTCHours());
    const [minutes, setMinutes] = useState(value.getUTCMinutes());
    const [openTimeSelector, setOpenTimeSelector] = useState<"hours" | "minutes" | null>(null);

    const popoverRef = useRef<HTMLDivElement>(null);
    const timeSelectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setOpenTimeSelector(null);
            } else if (timeSelectorRef.current && !timeSelectorRef.current.contains(event.target as Node)) {
                setOpenTimeSelector(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    useEffect(() => {
        setHours(value.getUTCHours());
        setMinutes(value.getUTCMinutes());
    }, [value]);

    const daysInMonth = new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1).getUTCDay();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 1));
    };

    const validateAndSetDate = (dateToValidate: Date) => {
        if (inline) {
            onChange(dateToValidate);
        } else {
            const now = new Date();
            if (dateToValidate < now) {
                const snappedDate = new Date(now.getTime() + 60000);
                onChange(snappedDate);
                setHours(snappedDate.getUTCHours());
                setMinutes(snappedDate.getUTCMinutes());
            } else {
                onChange(dateToValidate);
            }
            setIsOpen(false);
        }
    };

    const handleSelectDay = (day: number) => {
        const newDate = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day, hours, minutes));
        validateAndSetDate(newDate);
    };

    const handleConfirm = () => {
        const newDate = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), value.getUTCDate(), hours, minutes));
        validateAndSetDate(newDate);
    };

    const handleKeyDown = (e: React.KeyboardEvent, setter: React.Dispatch<React.SetStateAction<number>>, maxVal: number) => {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setter((prev: number) => (prev + 1) % (maxVal + 1));
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setter((prev: number) => (prev - 1 + (maxVal + 1)) % (maxVal + 1));
        }
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const weekDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    const formatDate = (date: Date) => {
        return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
    };

    const formatTime = (date: Date) => {
        return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    };

    const renderCalendar = () => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = value.getUTCDate() === d && value.getUTCMonth() === viewDate.getUTCMonth() && value.getUTCFullYear() === viewDate.getUTCFullYear();
            const isPastDay = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), d, 23, 59, 59)) < new Date();

            days.push(
                <button
                    key={d}
                    disabled={isPastDay}
                    onClick={() => handleSelectDay(d)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all focus:outline-none ${isPastDay
                        ? "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent"
                        : isSelected
                            ? "bg-[var(--neon-teal)] text-black font-bold"
                            : "text-foreground hover:bg-secondary/60 dark:hover:bg-white/10"
                        }`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const now = new Date();
    const currentUTCYear = now.getUTCFullYear();
    const currentUTCMonth = now.getUTCMonth();
    const isPrevDisabled = viewDate.getUTCFullYear() < currentUTCYear || (viewDate.getUTCFullYear() === currentUTCYear && viewDate.getUTCMonth() <= currentUTCMonth);

    const renderCalendarContent = () => (
        <div className={`p-5 bg-card rounded-2xl ${!inline ? 'shadow-2xl border border-border/50 absolute bottom-full left-0 mb-2 z-50 w-80' : 'w-full'}`}>

            <div className="flex justify-between items-center mb-5 px-1">
                <button
                    onClick={handlePrevMonth}
                    disabled={isPrevDisabled}
                    className={`p-1 transition-colors outline-none ${isPrevDisabled
                        ? "opacity-30 cursor-not-allowed text-muted-foreground"
                        : "text-muted-foreground hover:text-foreground cursor-pointer"
                        }`}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-foreground font-bold text-sm tracking-wide">
                    {monthNames[viewDate.getUTCMonth()]} {viewDate.getUTCFullYear()}
                </div>
                <button onClick={handleNextMonth} className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>


            <div className="grid grid-cols-7 gap-1 mb-3">
                {weekDays.map(day => (
                    <div key={day} className="w-8 flex justify-center text-[10px] font-bold text-muted-foreground">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 gap-y-2 mb-4">
                {renderCalendar()}
            </div>


            {!hideTime && (
                <div className="flex items-center justify-between mt-2 pt-2">
                    <div className="flex items-center gap-4 text-foreground font-medium pl-1" ref={timeSelectorRef}>
                        <div className="relative">
                            <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => setOpenTimeSelector(openTimeSelector === "hours" ? null : "hours")}
                            >
                                <span className="text-sm min-w-[1.2rem] text-center">{hours}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-transform ${openTimeSelector === "hours" ? "rotate-180" : ""}`} />
                            </div>
                            {openTimeSelector === "hours" && (
                                <div className="absolute bottom-full left-[-8px] mb-4 w-14 max-h-[160px] bg-background rounded-lg border border-border shadow-xl z-50 py-1 flex flex-col">
                                    <style>{`
                                        .time-scroll::-webkit-scrollbar { width: 2px; }
                                        .time-scroll::-webkit-scrollbar-thumb { background: rgba(13,155,95,0.3); border-radius: 4px; }
                                    `}</style>
                                    <div className="time-scroll h-full w-full overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <div
                                                key={i}
                                                onClick={() => { setHours(i); setOpenTimeSelector(null); }}
                                                className={`px-2 py-1.5 text-[13px] text-center cursor-pointer transition-colors ${hours === i ? "text-[var(--neon-teal)] bg-secondary dark:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 dark:hover:bg-secondary dark:bg-white/5"}`}
                                            >
                                                {String(i).padStart(2, '0')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => setOpenTimeSelector(openTimeSelector === "minutes" ? null : "minutes")}
                            >
                                <span className="text-sm min-w-[1.2rem] text-center">{String(minutes).padStart(2, '0')}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-transform ${openTimeSelector === "minutes" ? "rotate-180" : ""}`} />
                            </div>
                            {openTimeSelector === "minutes" && (
                                <div className="absolute bottom-full left-[-8px] mb-4 w-14 max-h-[160px] bg-background rounded-lg border border-border shadow-xl z-50 py-1 flex flex-col">
                                    <div className="time-scroll h-full w-full overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                                        {Array.from({ length: 60 }, (_, i) => (
                                            <div
                                                key={i}
                                                onClick={() => { setMinutes(i); setOpenTimeSelector(null); }}
                                                className={`px-2 py-1.5 text-[13px] text-center cursor-pointer transition-colors ${minutes === i ? "text-[var(--neon-teal)] bg-secondary dark:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 dark:hover:bg-secondary dark:bg-white/5"}`}
                                            >
                                                {String(i).padStart(2, '0')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="px-5 py-1.5 rounded-xl border border-[var(--neon-teal)] text-[var(--neon-teal)] text-sm font-bold hover:bg-[var(--neon-teal)]/10 transition-colors cursor-pointer"
                    >
                        Confirm
                    </button>
                </div>
            )}
        </div>
    );

    if (inline) {
        return <div className="w-full relative">{renderCalendarContent()}</div>;
    }

    return (
        <div className="relative w-full" ref={popoverRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="mt-3 w-full bg-background border border-border hover:border-border transition-all rounded-xl px-5 py-3.5 text-foreground flex justify-between items-center cursor-pointer"
            >
                <span className="font-bold text-lg">{formatDate(value)}</span>
                <span className="text-[var(--neon-teal)] font-medium text-base">{formatTime(value)} (UTC)</span>
            </div>

            {isOpen && renderCalendarContent()}
        </div>
    );
}
