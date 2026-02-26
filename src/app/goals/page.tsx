'use client';

import ProfileSettings from '@/components/ProfileSettings';

export default function GoalsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <ProfileSettings isOpen={true} onClose={() => {}} isPage={true} />
    </div>
  );
}
