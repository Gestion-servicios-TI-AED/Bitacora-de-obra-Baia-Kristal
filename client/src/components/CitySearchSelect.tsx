import { useState, useRef, useEffect } from 'react';
import { colombianCities } from '../data/colombianCities';
import { Search, MapPin, ChevronDown, X } from 'lucide-react';

interface CitySearchSelectProps {
    value: string;
    onChange: (city: string) => void;
    className?: string;
    placeholder?: string;
}

export default function CitySearchSelect({ value, onChange, className = '', placeholder = 'Buscar ciudad...' }: CitySearchSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = search
        ? colombianCities.filter(c => c.toLowerCase().includes(search.toLowerCase()))
        : colombianCities;

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (city: string) => {
        onChange(city);
        setSearch('');
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => {
                    setOpen(!open);
                    setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left"
            >
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={`flex-1 truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>
                    {value || placeholder}
                </span>
                {value ? (
                    <X className="w-4 h-4 text-slate-400 hover:text-red-500 transition-colors" onClick={handleClear} />
                ) : (
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                                placeholder="Escribe para filtrar..."
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* City List */}
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length > 0 ? (
                            filtered.map((city) => (
                                <button
                                    key={city}
                                    type="button"
                                    onClick={() => handleSelect(city)}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 flex items-center gap-2 ${city === value
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    {city}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-slate-400">
                                No se encontraron ciudades
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
