import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import DriverCareResourcesPanel from '@/components/driver-care/DriverCareResourcesPanel';

const DriverCareResources: React.FC = () => (
  <div>
    <PageHeader
      title="Skills & Knowledge"
      subtitle="คลังทักษะและความรู้ Driver Care — รวมพฤติกรรมก่อนลาออก"
      backPath="/driver-care"
    />
    <div className="px-4 md:px-6">
      <DriverCareResourcesPanel />
    </div>
  </div>
);

export default DriverCareResources;
