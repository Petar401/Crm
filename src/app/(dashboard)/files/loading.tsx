import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <ListSkeleton columns={4} />
    </div>
  );
}
