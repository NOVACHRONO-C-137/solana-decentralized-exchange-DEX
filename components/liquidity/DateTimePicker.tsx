import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

interface DateTimePickerProps {
    value: Date;
    onChange: (date: Date) => void;
}

export function DateTimePicker({ value, onChange }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value);

    const [hours, setHours] = useState(value.getUTCHours());
    const [minutes, setMinutes] = useState(value.getUTCMinutes());

    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sync hours/mins when value prop changes externally (though rare here)
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

    const handleSelectDay = (day: number) => {
        const newDate = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day, hours, minutes));
        onChange(newDate);
        setIsOpen(false);
    };

    const handleConfirm = () => {
        const newDate = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), value.getUTCDate(), hours, minutes));
        onChange(newDate);
        setIsOpen(false);
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
            days.push(
                <button
                    key={d}
                    onClick={() => handleSelectDay(d)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all focus:outline-none ${isSelected
                        ? "bg-[#c4d6ff] text-black font-bold"
                        : "text-white hover:bg-white/10"
                        }`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="relative w-full" ref={popoverRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="mt-3 w-full bg-[#0a0d14] border border-white/10 hover:border-white/20 transition-all rounded-xl px-5 py-3.5 text-white flex justify-between items-center cursor-pointer"
            >
                <span className="font-bold text-lg">{formatDate(value)}</span>
                <span className="text-[var(--neon-teal)] font-medium text-base">{formatTime(value)} (UTC)</span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-5 bg-[#0f1421] rounded-2xl shadow-2xl border border-white/5 z-50 w-80">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-5 px-1">
                        <button onClick={handlePrevMonth} className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer outline-none">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-white font-bold text-sm tracking-wide">
                            {monthNames[viewDate.getUTCMonth()]} {viewDate.getUTCFullYear()}
                        </div>
                        <button onClick={handleNextMonth} className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer outline-none">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-1 mb-3">
                        {weekDays.map(day => (
                            <div key={day} className="w-8 flex justify-center text-[10px] font-bold text-white/60">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1 gap-y-2 mb-4">
                        {renderCalendar()}
                    </div>

                    {/* Time & Confirm */}
                    <div className="flex items-center justify-between mt-2 pt-2">
                        <div className="flex items-center gap-4 text-white font-medium pl-1">
                            <div className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="number"
                                    value={hours}
                                    onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                                    onKeyDown={(e) => handleKeyDown(e, setHours, 23)}
                                    className="w-5 bg-transparent text-white focus:outline-none text-sm p-0 m-0 appearance-none text-center"
                                    style={{ MozAppearance: 'textfield' }}
                                />
                                <ChevronDown className="w-3.5 h-3.5 text-white/60" />
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    onKeyDown={(e) => handleKeyDown(e, setMinutes, 59)}
                                    className="w-5 bg-transparent text-white focus:outline-none text-sm p-0 m-0 appearance-none text-center"
                                    style={{ MozAppearance: 'textfield' }}
                                />
                                <ChevronDown className="w-3.5 h-3.5 text-white/60" />
                            </div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            className="px-5 py-1.5 rounded-xl border border-[var(--neon-teal)] text-[var(--neon-teal)] text-sm font-bold hover:bg-[var(--neon-teal)]/10 transition-colors cursor-pointer"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
