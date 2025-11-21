import {useState} from 'react';
import {logger} from '@/utils';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '@/services/db.ts';
import type {CategoryGroup} from '@/types';
import {getColorPalette} from '@/utils/colorUtils.ts';
import {useConfirm} from "@/components/ui/confirm-provider";
import {useToast} from "@/hooks/use-toast";
import {Label} from '@/components/ui/label';
import {MAX_CATEGORY_GROUPS} from "@/constants";

function CategoryGroupManager() {
    const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const {confirm} = useConfirm();
    const {toast} = useToast();

    // Fetch all groups with live updates
    const allGroups = useLiveQuery(() => db.categoryGroups.orderBy('sortOrder').toArray(), []);

    const handleCreate = () => {
        const nextSortOrder = allGroups ? Math.max(...allGroups.map(g => g.sortOrder), 0) + 1 : 1;
        const colorPalette = getColorPalette();

        setIsCreating(true);
        setEditingGroup({
            id: crypto.randomUUID(),
            name: '',
            description: '',
            baseColor: colorPalette[0],
            priority: nextSortOrder,
            sortOrder: nextSortOrder,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    };

    const handleSave = async (group: CategoryGroup) => {
        try {
            if (isCreating) {
                await db.categoryGroups.add(group);
            } else {
                await db.categoryGroups.update(group.id, {
                    ...group,
                    updatedAt: new Date(),
                });
            }
            setEditingGroup(null);
            setIsCreating(false);
            toast({title: "Success", description: "Group saved successfully"});
        } catch (error) {
            logger.error('Failed to save group:', error);
            toast({title: "Error", description: "Failed to save group. Please try again.", variant: "destructive"});
        }
    };

    const handleDelete = async (group: CategoryGroup) => {
        if (group.isDefault) {
            toast({title: "Error", description: "Cannot delete default groups.", variant: "destructive"});
            return;
        }

        if (await confirm({
            title: 'Delete Group',
            description: `Are you sure you want to delete "${group.name}"? Categories in this group will become uncategorized.`,
            confirmText: 'Delete',
            variant: 'destructive'
        })) {
            try {
                // Remove group reference from all rules
                const rulesInGroup = await db.categoryRules.where('groupId').equals(group.id).toArray();
                for (const rule of rulesInGroup) {
                    await db.categoryRules.update(rule.id, {
                        groupId: undefined,
                        colorVariant: 0,
                        updatedAt: new Date(),
                    });
                }

                // Delete the group
                await db.categoryGroups.delete(group.id);
                toast({title: "Success", description: "Group deleted successfully"});
            } catch (error) {
                logger.error('Failed to delete group:', error);
                toast({
                    title: "Error",
                    description: "Failed to delete group. Please try again.",
                    variant: "destructive"
                });
            }
        }
    };

    const handleCancel = () => {
        setEditingGroup(null);
        setIsCreating(false);
    };

    const canAddMore = !allGroups || allGroups.length < MAX_CATEGORY_GROUPS;

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Category Groups</h1>
                <p className="text-gray-600">
                    Manage category groups for organizing spending priorities.{' '}
                    {allGroups?.length || 0}/{MAX_CATEGORY_GROUPS} groups used.
                </p>
            </div>

            {/* Create button */}
            <div className="mb-6">
                <button
                    onClick={handleCreate}
                    disabled={!canAddMore || isCreating}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    + Create New Group
                </button>
                {!canAddMore && (
                    <p className="mt-2 text-sm text-gray-600">
                        Maximum number of groups ({MAX_CATEGORY_GROUPS}) reached.
                    </p>
                )}
            </div>

            {/* Groups list */}
            {!allGroups || allGroups.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    No category groups yet. Create one to get started!
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Color
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Priority
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {allGroups.map(group => (
                            <tr key={group.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div
                                        className="w-8 h-8 rounded border border-gray-300"
                                        style={{backgroundColor: group.baseColor}}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <span className="font-medium text-gray-900">{group.name}</span>
                                        {group.isDefault && (
                                            <span
                                                className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Default
                        </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {group.description}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {group.priority}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => setEditingGroup(group)}
                                        className="text-blue-600 hover:text-blue-900 mr-3"
                                    >
                                        Edit
                                    </button>
                                    {!group.isDefault && (
                                        <button
                                            onClick={() => handleDelete(group)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Editor modal */}
            {editingGroup && (
                <GroupEditorModal
                    group={editingGroup}
                    isCreating={isCreating}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
}

interface GroupEditorModalProps {
    group: CategoryGroup;
    isCreating: boolean;
    onSave: (group: CategoryGroup) => void;
    onCancel: () => void;
}

function GroupEditorModal({group: initialGroup, isCreating, onSave, onCancel}: Readonly<GroupEditorModalProps>) {
    const [group, setGroup] = useState<CategoryGroup>(initialGroup);
    const colorPalette = getColorPalette();

    const isValid = group.name.trim().length > 0 && group.description.trim().length > 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {isCreating ? 'Create New Group' : `Edit Group: ${initialGroup.name}`}
                    </h2>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                Group Name <span className="text-red-500">*</span>
                            </Label>
                            <input
                                type="text"
                                value={group.name}
                                onChange={e => setGroup({...group, name: e.target.value})}
                                placeholder="e.g., Critical, Important, Optional"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={group.isDefault}
                            />
                            {group.isDefault && (
                                <p className="mt-1 text-xs text-gray-500">Default groups cannot be renamed</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                Description <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                                value={group.description}
                                onChange={e => setGroup({...group, description: e.target.value})}
                                placeholder="e.g., Essential expenses required for basic living"
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority: {group.priority}
                                <span className="text-gray-500 font-normal ml-2">
                  (Lower = more critical, appears first)
                </span>
                            </Label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={group.priority}
                                onChange={e => setGroup({...group, priority: parseInt(e.target.value)})}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0 (Most Critical)</span>
                                <span>5</span>
                                <span>10 (Least Critical)</span>
                            </div>
                        </div>

                        {/* Base Color */}
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                Base Color <span className="text-red-500">*</span>
                            </Label>
                            <div className="grid grid-cols-6 gap-2">
                                {colorPalette.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setGroup({...group, baseColor: color})}
                                        className={`w-12 h-12 rounded border-2 transition-all ${group.baseColor === color
                                            ? 'border-blue-500 scale-110'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                        style={{backgroundColor: color}}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Selected: <span className="font-mono">{group.baseColor}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(group)}
                        disabled={!isValid}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isCreating ? 'Create Group' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CategoryGroupManager;
