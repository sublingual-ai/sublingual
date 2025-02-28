import { SpreadsheetProps } from "@/types/metrics";
import { useRef, useEffect } from "react";

export function Spreadsheet({ columns, data, onRowClick, selectedItem, onColumnResize }: SpreadsheetProps) {
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
                        <div className="flex-1">{col.name}</div>
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