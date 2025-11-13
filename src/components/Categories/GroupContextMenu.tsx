import { useEffect, useState, useRef } from 'react';
import type { CategoryGroup } from '../../types';
import { db } from '../../services/db';

interface GroupContextMenuProps {
  x: number;
  y: number;
  categoryName: string;
  onGroupSelect: (groupId: string, categoryName: string) => void;
  onClose: () => void;
}

/**
 * Context menu for changing a category's group via right-click
 * Shows list of available groups with color badges
 */
function GroupContextMenu({ x, y, categoryName, onGroupSelect, onClose }: GroupContextMenuProps) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadGroups() {
      try {
        const allGroups = await db.categoryGroups.orderBy('sortOrder').toArray();
        setGroups(allGroups);
      } catch (error) {
        console.error('Failed to load groups:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, []);

  useEffect(() => {
    // Close menu on click outside
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Close menu on escape key
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(x, window.innerWidth - 280),
    y: Math.min(y, window.innerHeight - (groups.length * 48 + 100)),
  };

  const handleGroupClick = (groupId: string) => {
    onGroupSelect(groupId, categoryName);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[260px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-200">
        <p className="text-xs text-gray-600 font-medium">Change category group</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{categoryName}</p>
      </div>

      {loading ? (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          Loading groups...
        </div>
      ) : groups.length === 0 ? (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          No groups available
        </div>
      ) : (
        <div className="py-1">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => handleGroupClick(group.id)}
              className="w-full px-3 py-2 hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
            >
              <div
                className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: group.baseColor }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800">{group.name}</div>
                <div className="text-xs text-gray-500 truncate">{group.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
        Priority order: Critical → Optional
      </div>
    </div>
  );
}

export default GroupContextMenu;
