'use client';

import Kitchen from '@/components/Kitchen';

export default function KitchenPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Kitchen isOpen={true} onClose={() => {}} isPage={true} />
    </div>
  );
}
