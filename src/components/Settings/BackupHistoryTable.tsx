import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';

export function BackupHistoryTable() {
    const backupHistory = useLiveQuery(() =>
        db.backupHistory.orderBy('timestamp').reverse().limit(10).toArray()
    );

    if (!backupHistory || backupHistory.length === 0) {
        return null;
    }

    return (
        <section className="space-y-4">
            <h2 className="text-xl font-semibold">Recent Backups</h2>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left">Timestamp</th>
                            <th className="px-4 py-2 text-left">Provider</th>
                            <th className="px-4 py-2 text-left">Size</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Encrypted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {backupHistory.map(backup => (
                            <tr key={backup.id} className="border-t border-gray-200">
                                <td className="px-4 py-2">{new Date(backup.timestamp).toLocaleString()}</td>
                                <td className="px-4 py-2 capitalize">{backup.provider}</td>
                                <td className="px-4 py-2">
                                    {backup.size ? `${(backup.size / 1024).toFixed(1)} KB` : '-'}
                                </td>
                                <td className="px-4 py-2">
                                    {backup.success ? (
                                        <span className="text-green-600">✓ Success</span>
                                    ) : (
                                        <span className="text-red-600">✗ Failed</span>
                                    )}
                                </td>
                                <td className="px-4 py-2">
                                    {backup.encrypted ? '🔒 Yes' : 'No'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
