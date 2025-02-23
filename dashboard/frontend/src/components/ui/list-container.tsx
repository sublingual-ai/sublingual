interface ListContainerProps {
  title: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const ListContainer = ({ title, children, headerContent }: ListContainerProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {headerContent}
      </div>
      {children}
    </div>
  );
}; 