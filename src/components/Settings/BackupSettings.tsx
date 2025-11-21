// Backup Settings Component
// Comprehensive UI for configuring automatic backups, cloud providers, and manual backup/restore

import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '@/services/db.ts';
import {restoreBackup, validateBackup} from '@/services/databaseBackup.ts';
import * as localProvider from '../../services/backupProviders/localBackupProvider';
import * as googleDriveProvider from '../../services/backupProviders/googleDriveProvider';
import * as dropboxProvider from '../../services/backupProviders/dropboxProvider';
import {logger} from '@/utils';
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {useConfirm} from '@/components/ui/confirm-provider';
import {ManualBackupSection} from './ManualBackupSection';
import {BackupHistoryTable} from './BackupHistoryTable';
import type {BackupData, BackupMetadata, BackupProvider} from '@/types/backupTypes.ts';
import {DecryptionKeyDialog} from './DecryptionKeyDialog';

export type BackupDataStructure = { data: [], metadata: BackupMetadata }

function BackupSettings() {
    const settings = useLiveQuery(() => db.settings.get('default'));
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [isRestoring, setIsRestoring] = useState(false);
    const [showEncryptionKey, setShowEncryptionKey] = useState(false);
    const [showDecryptionDialog, setShowDecryptionDialog] = useState(false);
    const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);

    if (!settings) {
        return <div className="p-6">Loading settings...</div>;
    }

    // Handlers for automatic backup settings
    const handleToggleBackup = async (enabled: boolean) => {
        await db.settings.update('default', { backupEnabled: enabled });
        toast({
            title: enabled ? 'Automatic backups enabled' : 'Automatic backups disabled',
            description: enabled ? 'Backups will run automatically based on your schedule' : 'Automatic backups have been turned off',
        });
    };

    const handleIntervalChange = async (interval: number) => {
        await db.settings.update('default', { backupInterval: interval });
    };

    const handleProviderToggle = async (provider: BackupProvider, enabled: boolean) => {
        const currentProviders = settings.backupProviders || [];
        const newProviders = enabled
            ? [...currentProviders, provider]
            : currentProviders.filter(p => p !== provider);

        await db.settings.update('default', { backupProviders: newProviders });
    };

    const handleEncryptionKeyChange = async (key: string) => {
        await db.settings.update('default', { backupEncryptionKey: key });
    };

    const handleIncludeLogsChange = async (include: boolean) => {
        await db.settings.update('default', { backupIncludeLogs: include });
    };

    // Cloud provider authentication
    const handleGoogleDriveConnect = async () => {
        try {
            const config = settings.googleDriveConfig || { connected: false };
            const accessToken = await googleDriveProvider.authenticate(config);

            await db.settings.update('default', {
                googleDriveConfig: {
                    ...config,
                    accessToken,
                    connected: true,
                    tokenExpiry: new Date(Date.now() + 3600000), // 1 hour
                },
            });

            toast({
                title: 'Connected to Google Drive',
                description: 'You can now backup to Google Drive',
            });
        } catch (error) {
            logger.error('[BackupSettings] Google Drive connection failed:', error);
            toast({
                title: 'Connection failed',
                description: error instanceof Error ? error.message : 'Failed to connect to Google Drive',
                variant: 'destructive',
            });
        }
    };

    const handleDropboxConnect = async () => {
        try {
            const config = settings.dropboxConfig || { connected: false };
            const accessToken = await dropboxProvider.authenticate(config);

            await db.settings.update('default', {
                dropboxConfig: {
                    ...config,
                    accessToken,
                    connected: true,
                },
            });

            toast({
                title: 'Connected to Dropbox',
                description: 'You can now backup to Dropbox',
            });
        } catch (error) {
            logger.error('[BackupSettings] Dropbox connection failed:', error);
            toast({
                title: 'Connection failed',
                description: error instanceof Error ? error.message : 'Failed to connect to Dropbox',
                variant: 'destructive',
            });
        }
    };

    const handleDisconnect = async (provider: 'googledrive' | 'dropbox') => {
        const field = provider === 'googledrive' ? 'googleDriveConfig' : 'dropboxConfig';
        await db.settings.update('default', {
            [field]: { connected: false },
        });

        toast({
            title: 'Disconnected',
            description: `Disconnected from ${provider === 'googledrive' ? 'Google Drive' : 'Dropbox'}`,
        });
    };



    // Restore backup (currently only supports local files)
    const handleRestoreBackup = async () => {
        const confirmed = await confirm({
            title: 'Restore Backup',
            description: 'This will replace all current data with the backup. This action cannot be undone. Are you sure?',
            confirmText: 'Restore',
            cancelText: 'Cancel',
        });

        if (!confirmed) return;

        try {
            // Load backup from local file
            const backupData = await localProvider.loadBackup();

            logger.info('[handleRestoreBackup] backup loaded: ', backupData);

            // Validate backup
            const isValid = await validateBackup(backupData);
            if (!isValid) {
                throw new Error('Invalid backup file');
            }

            // Check if encrypted
            if (backupData.metadata.encrypted) {
                setPendingBackupData(backupData);
                setShowDecryptionDialog(true);
                return;
            }

            // If not encrypted, proceed with restore
            await performRestore(backupData);

        } catch (error) {
            logger.error('[handleRestoreBackup] Restore failed:', error);
            toast({
                title: 'Restore failed',
                description: error instanceof Error ? error.message : 'Failed to restore backup',
                variant: 'destructive',
            });
        }
    };

    const performRestore = async (backupData: BackupData, key?: string) => {
        try {
            setIsRestoring(true);

            await restoreBackup(backupData, {
                encryptionKey: key,
                merge: false,
            });

            toast({
                title: 'Backup restored',
                description: 'Your data has been restored successfully. The page will reload.',
            });

            // Reload page to reflect changes
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            logger.error('[performRestore] Restore failed:', error);
            // If it was a decryption error, re-throw to be handled by the dialog logic if needed, 
            // or just show toast.
            // For now, we let the caller handle it or show toast here.
            // But since this is called from handleDecryptionConfirm, we might want to keep the dialog open on error?
            // Let's just throw and catch in the handler.
            throw error;
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDecryptionConfirm = async (key: string) => {
        if (!pendingBackupData) return;

        try {
            await performRestore(pendingBackupData, key);
            setShowDecryptionDialog(false);
            setPendingBackupData(null);
        } catch (error) {
            toast({
                title: 'Restore failed',
                description: error instanceof Error ? error.message : 'Failed to restore backup. Check your decryption key.',
                variant: 'destructive',
            });
            // Keep dialog open to try again
        }
    };

    const intervalOptions = [
        { value: 60, label: '1 hour' },
        { value: 360, label: '6 hours' },
        { value: 720, label: '12 hours' },
        { value: 1440, label: '24 hours' },
        { value: 10080, label: '7 days' },
    ];

    return (
        <div className="p-6 space-y-8">
            {/* Automatic Backup Configuration */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Automatic Backup</h2>

                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="backup-enabled"
                        checked={settings.backupEnabled || false}
                        onChange={(e) => handleToggleBackup(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="backup-enabled" className="text-sm font-medium">
                        Enable automatic backups
                    </label>
                </div>

                {settings.backupEnabled && (
                    <div className="space-y-4 pl-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Backup Interval</label>
                            <select
                                value={settings.backupInterval || 1440}
                                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                {intervalOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Backup Providers</label>
                            <div className="space-y-2">
                                {(['local', 'googledrive', 'dropbox'] as BackupProvider[]).map(provider => (
                                    <div key={provider} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id={`provider-${provider}`}
                                            checked={(settings.backupProviders || []).includes(provider)}
                                            onChange={(e) => handleProviderToggle(provider, e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <label htmlFor={`provider-${provider}`} className="text-sm capitalize">
                                            {provider === 'googledrive' ? 'Google Drive' : provider}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Encryption Key (optional)</label>
                            <div className="flex space-x-2">
                                <input
                                    type={showEncryptionKey ? 'text' : 'password'}
                                    value={settings.backupEncryptionKey || ''}
                                    onChange={(e) => handleEncryptionKeyChange(e.target.value)}
                                    placeholder="Leave empty for no encryption"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                                >
                                    {showEncryptionKey ? '🙈' : '👁️'}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="include-logs"
                                checked={settings.backupIncludeLogs || false}
                                onChange={(e) => handleIncludeLogsChange(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <label htmlFor="include-logs" className="text-sm">
                                Include logs in backup
                            </label>
                            <span className="text-xs text-gray-500">(logs can be large)</span>
                        </div>

                        {settings.backupLastRun && (
                            <div className="text-sm text-gray-600">
                                Last backup: {new Date(settings.backupLastRun).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Cloud Provider Configuration */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Cloud Provider Configuration</h2>

                {/* Google Drive */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium">Google Drive</h3>

                    {!settings.googleDriveConfig?.connected ? (
                        <>
                            <details className="text-sm">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">ℹ️ How to get a Client ID</summary>
                                <div className="pl-4 mt-2 space-y-2 text-gray-700">
                                    <p>1. Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a></p>
                                    <p>2. Create a new project or select an existing one</p>
                                    <p>3. Click "Create Credentials" → "OAuth client ID"</p>
                                    <p>4. Choose "Web application" as the application type</p>
                                    <p>5. Add <code className="bg-gray-100 px-1 rounded">{window.location.origin}</code> to "Authorized JavaScript origins"</p>
                                    <p>6. Add <code className="bg-gray-100 px-1 rounded">{window.location.origin}/oauth/callback</code> to "Authorized redirect URIs"</p>
                                    <p>7. Copy the Client ID and paste it below</p>
                                </div>
                            </details>
                            <Button onClick={handleGoogleDriveConnect} disabled={!settings.googleDriveConfig?.clientId}>
                                Connect to Google Drive
                            </Button>
                        </>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-green-600">✓ Connected</span>
                            <Button variant="outline" onClick={() => handleDisconnect('googledrive')}>
                                Disconnect
                            </Button>
                        </div>
                    )}
                </div>

                {/* Dropbox */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium">Dropbox</h3>

                    {!settings.dropboxConfig?.connected ? (
                        <>
                            <details className="text-sm">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">ℹ️ How to get an App Key</summary>
                                <div className="pl-4 mt-2 space-y-2 text-gray-700">
                                    <p>1. Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Dropbox App Console</a></p>
                                    <p>2. Click "Create app"</p>
                                    <p>3. Choose "Scoped access" API</p>
                                    <p>4. Choose "Full Dropbox" access type</p>
                                    <p>5. Give your app a name</p>
                                    <p>6. In the app settings, add <code className="bg-gray-100 px-1 rounded">{window.location.origin}/oauth/callback</code> to "Redirect URIs"</p>
                                    <p>7. Copy the "App key" and paste it below</p>
                                </div>
                            </details>
                            <div>
                                <label className="block text-sm font-medium mb-1">App Key</label>
                                <input
                                    type="text"
                                    value={settings.dropboxConfig?.clientId || ''}
                                    onChange={(e) => db.settings.update('default', {
                                        dropboxConfig: {
                                            ...(settings.dropboxConfig || { connected: false }),
                                            clientId: e.target.value,
                                        },
                                    })}
                                    placeholder="Your Dropbox App Key"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                            </div>
                            <Button onClick={handleDropboxConnect} disabled={!settings.dropboxConfig?.clientId}>
                                Connect to Dropbox
                            </Button>
                        </>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-green-600">✓ Connected</span>
                            <Button variant="outline" onClick={() => handleDisconnect('dropbox')}>
                                Disconnect
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* Manual Backup */}
            <ManualBackupSection settings={settings} />

            {/* Restore Backup */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Restore Backup</h2>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                        ⚠️ Warning: Restoring a backup will replace all current data. This action cannot be undone.
                    </p>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-2">Provider</label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id="restore-local"
                                    name="restore-provider"
                                    checked={true}
                                    readOnly
                                    className="h-4 w-4"
                                />
                                <label htmlFor="restore-local" className="text-sm">
                                    Local File
                                </label>
                            </div>
                        </div>
                    </div>

                    <Button onClick={handleRestoreBackup} disabled={isRestoring} variant="destructive">
                        {isRestoring ? 'Restoring...' : 'Restore from Local File'}
                    </Button>
                </div>
            </section>

            {/* Backup History */}
            <BackupHistoryTable />

            <DecryptionKeyDialog
                open={showDecryptionDialog}
                onOpenChange={(open) => {
                    setShowDecryptionDialog(open);
                    if (!open) setPendingBackupData(null);
                }}
                onConfirm={handleDecryptionConfirm}
                isRestoring={isRestoring}
            />
        </div>
    );
}

export default BackupSettings;
