import React from 'react';
import type { TrackingBucket } from '@/lib/unitRequestTracking';
import { cn } from '@/lib/utils';

type Props = {
  buckets: TrackingBucket[];
  onSelect: (bucket: TrackingBucket) => void;
  emptyMessage?: string;
  className?: string;
};

const TrackingBucketGrid: React.FC<Props> = ({ buckets, onSelect, emptyMessage, className }) => {
  if (buckets.length === 0) {
    return emptyMessage ? (
      <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {buckets.map((bucket) => (
        <button
          key={bucket.key}
          type="button"
          onClick={() => onSelect(bucket)}
          className="rounded-full border border-white/80 bg-white/70 px-3 py-2 text-xs font-medium text-foreground hover:border-orange-300/60 hover:bg-white shadow-sm touch-manipulation transition-colors"
        >
          {bucket.label}
          <span className="ml-1.5 tabular-nums text-muted-foreground">({bucket.count})</span>
        </button>
      ))}
    </div>
  );
};

export default TrackingBucketGrid;
