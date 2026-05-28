/**
 * Empty state for the couples list. Rendered when `couples.length
 * === 0 && !loading`.
 *
 * @module app/(dashboard)/couples/couples-list-empty
 */
import { Users } from 'lucide-react';

export function CouplesListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users size={40} strokeWidth={1.5} className="text-gray-300 mb-3" />
      <p className="text-gray-600 font-medium mb-2">No couples yet.</p>
      <p className="text-sm text-gray-500 mb-4">
        Start by adding your first couple.
      </p>
    </div>
  );
}
