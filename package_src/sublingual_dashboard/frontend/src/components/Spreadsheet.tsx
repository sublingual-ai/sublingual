import { SpreadsheetProps } from "@/types/metrics";

export function Spreadsheet({ columns, data, onRowClick, selectedItem, onColumnResize }: SpreadsheetProps) {
    return (
        <div className="flex-1 overflow-auto">
            <div className="grid border-b border-[#E2E3E3] bg-white sticky top-0 z-10 shadow-sm"
                style={{
                    gridTemplateColumns: columns.map(col => `${col.width}px`).join(' ')
                }}
            >
                {columns.map((col, i) => (
                    <div key={col.id} className={`px-3 py-2 text-xs font-semibold text-gray-900 flex items-center ${
                        i !== columns.length - 1 ? 'border-r border-[#E2E3E3]' : ''
                    }`}>
                        <div className="flex-1">{col.name}</div>
                        {i !== columns.length - 1 && (
                            <div 
                                className="w-1 h-full cursor-col-resize hover:bg-gray-200 rounded"
                                onMouseDown={(e) => onColumnResize(col.id, e)}
                            />
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
                                } ${col.align ? `text-${col.align}` : ''} truncate`}>
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