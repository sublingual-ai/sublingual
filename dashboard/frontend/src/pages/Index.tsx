import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";
import { LogFileProvider } from "@/contexts/LogFileContext";

const Index = () => {
  return (
    <LogFileProvider>
      <DashboardLayout>
        <div className="w-full">
          <RunsList />
        </div>
      </DashboardLayout>
    </LogFileProvider>
  );
};

export default Index;
