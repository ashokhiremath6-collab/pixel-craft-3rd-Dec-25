import StatusBadge from '../StatusBadge';

export default function StatusBadgeExample() {
  return (
    <div className="flex gap-2">
      <StatusBadge status="Quoted" />
      <StatusBadge status="Selected" />
      <StatusBadge status="Rejected" />
    </div>
  );
}