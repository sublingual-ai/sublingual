import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter as FilterIcon, X } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Filter, FilterOption } from "@/types/logs";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RunsFilterProps {
    filterOptions: FilterOption[];
    filters: Filter[];
    onFilterChange: (filters: Filter[]) => void;
}

export function RunsFilter({ filterOptions, filters, onFilterChange }: RunsFilterProps) {
    const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedOption = filterOptions.find(opt => opt.field === selectedCriteria);
    
    const filteredValues = selectedOption?.values.filter(value => 
        String(value).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (selectedOption.field === 'output_tokens' && 
         `${value}-${value + 100} tokens`.toLowerCase().includes(searchQuery.toLowerCase()))
    ) ?? [];

    const handleSelectionChange = (field: string, value: any) => {
        const existingFilter = filters.find(f => f.field === field);
        const values = existingFilter?.value || [];
        
        if (values.includes(value)) {
            if (values.length === 1) {
                onFilterChange(filters.filter(f => f.field !== field));
            } else {
                onFilterChange(filters.map(f => {
                    if (f.field === field) {
                        return { ...f, value: values.filter(v => v !== value) };
                    }
                    return f;
                }));
            }
        } else {
            if (existingFilter) {
                onFilterChange(filters.map(f => {
                    if (f.field === field) {
                        return { ...f, value: [...values, value] };
                    }
                    return f;
                }));
            } else {
                onFilterChange([...filters, { field, value: [value] }]);
            }
        }
    };

    const removeFilter = (index: number) => {
        onFilterChange(filters.filter((_, i) => i !== index));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <FilterIcon className="w-4 h-4" />
                            Add Filter
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                        <div className="space-y-4">
                            {!selectedCriteria ? (
                                <>
                                    <div className="text-sm font-medium mb-2">Select criteria to filter by:</div>
                                    <div className="space-y-2">
                                        {filterOptions.map(option => {
                                            const activeFilter = filters.find(f => f.field === option.field);
                                            const selectedCount = activeFilter?.value?.length || 0;
                                            
                                            return (
                                                <div
                                                    key={option.field}
                                                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                                                    onClick={() => setSelectedCriteria(option.field)}
                                                >
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{option.label}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {selectedCount > 0 ? `${selectedCount} selected` : 'No filters'}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
                                            onClick={() => {
                                                setSelectedCriteria(null);
                                                setSearchQuery("");
                                            }}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Back
                                        </button>
                                        <div className="text-sm font-medium">{selectedOption?.label}</div>
                                    </div>
                                    
                                    <Input
                                        placeholder="Search values..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="mb-2"
                                    />
                                    
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {filteredValues.map(value => {
                                            const filter = filters.find(f => f.field === selectedCriteria);
                                            const isChecked = filter?.value?.includes(value) ?? false;
                                            const label = selectedOption?.field === 'output_tokens' 
                                                ? `${value}-${value + 100} tokens`
                                                : String(value);
                                            
                                            return (
                                                <div key={value} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`${selectedCriteria}-${value}`}
                                                        checked={isChecked}
                                                        onCheckedChange={() => handleSelectionChange(selectedCriteria, value)}
                                                    />
                                                    <label 
                                                        htmlFor={`${selectedCriteria}-${value}`}
                                                        className="text-sm cursor-pointer"
                                                    >
                                                        {label}
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {filters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filters.map((filter, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1"
                        >
                            {filterOptions.find(opt => opt.field === filter.field)?.label}:
                            {Array.isArray(filter.value) && filter.value.map((v, i) => (
                                <span key={i}>
                                    {filter.field === 'output_tokens' ? `${v}-${v + 100}` : v}
                                    {i < filter.value.length - 1 ? ', ' : ''}
                                </span>
                            ))}
                            <button
                                onClick={() => removeFilter(index)}
                                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
} 