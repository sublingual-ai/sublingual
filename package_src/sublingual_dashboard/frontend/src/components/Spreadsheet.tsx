import { SpreadsheetProps } from "@/types/metrics";
import { useRef, useEffect, useState } from "react";
import { Filter, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LLMRun } from "@/types/logs";
import { getRunId } from "@/utils/metrics";

export function Spreadsheet({ 
    columns, 
    data, 
    onRowClick, 
    selectedItem, 
    onColumnResize,
    onFilter
}: SpreadsheetProps) {
    const resizingRef = useRef<{ columnId: string; startWidth: number; startX: number } | null>(null);
    const MIN_COLUMN_WIDTH = 100; // Minimum width to prevent text clipping
    
    // Ensure columns have adequate width when columns are added
    useEffect(() => {
        columns.forEach(col => {
            if (col.width < MIN_COLUMN_WIDTH) {
                onColumnResize(col.id, MIN_COLUMN_WIDTH);
            }
        });
    }, [columns.length]); // Only run when the number of columns changes

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { columnId, startWidth, startX } = resizingRef.current;
        const diff = e.clientX - startX;
        onColumnResize(columnId, Math.max(50, startWidth + diff));
    };

    const handleMouseUp = () => {
        resizingRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
    };

    const startResizing = (columnId: string, width: number, clientX: number) => {
        resizingRef.current = { columnId, startWidth: width, startX: clientX };
        document.body.style.cursor = 'col-resize';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Get unique values for each column for filtering
    const getUniqueValues = (columnId: string) => {
        const values = new Set<any>();
        data.forEach(item => {
            const column = columns.find(col => col.id === columnId);
            if (column) {
                const value = column.getValue(item);
                values.add(value);
            }
        });
        return Array.from(values).sort();
    };

    // Column filter component
    const ColumnFilter = ({ column }: { column: any }) => {
        const uniqueValues = getUniqueValues(column.id);
        const [selectedValues, setSelectedValues] = useState<string[]>([]);
        
        const handleFilterChange = (value: string, checked: boolean) => {
            const newSelectedValues = checked 
                ? [...selectedValues, value]
                : selectedValues.filter(v => v !== value);
                
            setSelectedValues(newSelectedValues);
            
            // Apply filter immediately
            if (newSelectedValues.length > 0) {
                // For each selected value, create a separate filter with its own runIds
                // This allows proper OR logic within the same column
                const matchingRunIds = data
                    .filter(item => {
                        const itemValue = column.getValue(item);
                        // For text fields, check if the selected value is contained in the item value
                        if (typeof itemValue === 'string' && column.id === 'message') {
                            return itemValue.toLowerCase().includes(value.toLowerCase());
                        }
                        // For other fields, check if the item value equals the selected value
                        return itemValue === value;
                    })
                    .map(item => getRunId(item as LLMRun));
                    
                // Create a single filter with all selected values and their combined runIds
                onFilter?.({
                    field: column.id,
                    value: newSelectedValues,
                    operator: 'in',
                    runIds: data
                        .filter(item => {
                            const itemValue = column.getValue(item);
                            // For text fields, check if any selected value is contained in the item value
                            if (typeof itemValue === 'string' && column.id === 'message') {
                                return newSelectedValues.some(v => 
                                    itemValue.toLowerCase().includes(v.toLowerCase())
                                );
                            }
                            // For other fields, check if the item value is in the selected values
                            return newSelectedValues.includes(itemValue);
                        })
                        .map(item => getRunId(item as LLMRun))
                });
            } else {
                // Clear filter if no values selected
                onFilter?.({
                    field: column.id,
                    value: [],
                    operator: 'clear',
                    runIds: []
                });
            }
        };
        
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className="ml-1 p-1 rounded-sm hover:bg-gray-100">
                        <Filter className="h-3 w-3 text-gray-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm">Filter by {column.name}</h4>
                        <div className="max-h-60 overflow-auto space-y-1">
                            {uniqueValues.map((value, i) => (
                                <div key={i} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`${column.id}-${i}`} 
                                        checked={selectedValues.includes(value)}
                                        onCheckedChange={(checked) => 
                                            handleFilterChange(value, checked === true)
                                        }
                                    />
                                    <Label 
                                        htmlFor={`${column.id}-${i}`}
                                        className="text-xs cursor-pointer"
                                    >
                                        {value}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };

    return (
        <div className="flex-1 overflow-auto">
            <div className="grid border-b border-[#E2E3E3] bg-white sticky top-0 z-10 shadow-sm"
                style={{
                    gridTemplateColumns: columns.map(col => `${col.width}px`).join(' ')
                }}
            >
                {columns.map((col, i) => (
                    <div key={col.id} className={`px-3 py-2 text-xs font-semibold text-gray-900 flex items-center relative ${
                        i !== columns.length - 1 ? 'border-r border-[#E2E3E3]' : ''
                    }`}>
                        <div className="flex-1 flex items-center">
                            {col.name}
                            {onFilter && <ColumnFilter column={col} />}
                        </div>
                        {i !== columns.length - 1 && (
                            <div 
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary-200 group"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    startResizing(col.id, col.width, e.clientX);
                                }}
                            >
                                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-[#E2E3E3] group-hover:bg-primary-400" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="divide-y divide-gray-100">
                {data.map((item, rowIndex) => (
                    <div 
                        key={rowIndex}
                        className={`grid hover:bg-[#F3F3F3] cursor-pointer ${
                            selectedItem === item ? 'bg-[#E8F0FE]' : ''
                        }`}
                        style={{
                            gridTemplateColumns: columns.map(col => `${col.width}px`).join(' ')
                        }}
                        onClick={() => onRowClick(item)}
                    >
                        {columns.map((col, i) => {
                            const value = col.getValue(item);
                            return (
                                <div key={col.id} className={`px-3 py-[6px] text-xs text-gray-700 ${
                                    i !== columns.length - 1 ? 'border-r border-[#E2E3E3]' : ''
                                } ${col.align ? `text-${col.align}` : ''} overflow-hidden text-ellipsis whitespace-nowrap`}>
                                    {value}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
} 