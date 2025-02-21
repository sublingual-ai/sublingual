
import { DashboardLayout } from "@/components/DashboardLayout";
import { RunsList } from "@/components/RunsList";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="w-full">
        <RunsList />
      </div>
    </DashboardLayout>
  );
};

export default Index;
