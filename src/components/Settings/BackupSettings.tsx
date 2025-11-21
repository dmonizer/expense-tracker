// Backup Settings Component
// Comprehensive UI for configuring automatic backups, cloud providers, and manual backup/restore

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { createBackup, restoreBackup, validateBackup } from '../../services/databaseBackup';
import * as localProvider from '../../services/backupProviders/localBackupProvider';
import * as googleDriveProvider from '../../services/backupProviders/googleDriveProvider';
import * as dropboxProvider from '../../services/backupProviders/dropboxProvider';
import { logger } from '../../utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-provider';
import type { BackupProvider } from '../../types/backupTypes';

function BackupSettings() {
    const settings = useLiveQuery(() => db.settings.get('default'));
    const backupHistory = useLiveQuery(() =>
        db.backupHistory.orderBy('timestamp').reverse().limit(10).toArray()
    );

    const { toast } = useToast();
    const { confirm } = useConfirm();

    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [manualProvider, setManualProvider] = useState<BackupProvider>('local');
    const [manualEncrypt, setManualEncrypt] = useState(false);
    const [manualEncryptionKey, setManualEncryptionKey] = useState('');
    const [manualIncludeLogs, setManualIncludeLogs] = useState(false);
    const [showEncryptionKey, setShowEncryptionKey] = useState(false);
    const [showManualEncryptionKey, setShowManualEncryptionKey] = useState(false);

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

    // Manual backup
    const handleManualBackup = async () => {
        try {
            setIsBackingUp(true);

            // Validate encryption key if encryption is enabled
            if (manualEncrypt && !manualEncryptionKey) {
                toast({
                    title: 'Encryption key required',
                    description: 'Please enter an encryption key to create an encrypted backup',
                    variant: 'destructive',
                });
                setIsBackingUp(false);
                return;
            }

            const backupData = await createBackup(manualProvider, {
                encrypt: manualEncrypt,
                encryptionKey: manualEncrypt ? manualEncryptionKey : undefined,
                includeLogs: manualIncludeLogs,
            });

            const dataString = JSON.stringify(backupData);

            // Save using selected provider
            switch (manualProvider) {
                case 'local':
                    await localProvider.saveBackup(dataString, backupData.metadata);
                    break;
                case 'googledrive':
                    if (!settings.googleDriveConfig?.accessToken) {
                        throw new Error('Google Drive not connected');
                    }
                    await googleDriveProvider.saveBackup(
                        dataString,
                        backupData.metadata,
                        settings.googleDriveConfig.accessToken
                    );
                    break;
                case 'dropbox':
                    if (!settings.dropboxConfig?.accessToken) {
                        throw new Error('Dropbox not connected');
                    }
                    await dropboxProvider.saveBackup(
                        dataString,
                        backupData.metadata,
                        settings.dropboxConfig.accessToken
                    );
                    break;
            }

            // Record in history
            await db.backupHistory.add({
                id: backupData.metadata.id,
                timestamp: new Date(),
                provider: manualProvider,
                success: true,
                encrypted: manualEncrypt,
                size: backupData.metadata.size,
                metadata: backupData.metadata,
            });

            toast({
                title: 'Backup created',
                description: `Backup saved successfully to ${manualProvider}`,
            });
        } catch (error) {
            logger.error('[BackupSettings] Manual backup failed:', error);
            toast({
                title: 'Backup failed',
                description: error instanceof Error ? error.message : 'Failed to create backup',
                variant: 'destructive',
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    // Restore backup
    const handleRestoreBackup = async () => {
        try {
            const confirmed = await confirm({
                title: 'Restore Backup',
                description: 'This will replace all current data with the backup. This action cannot be undone. Are you sure?',
                confirmText: 'Restore',
                cancelText: 'Cancel',
            });

            if (!confirmed) return;

            setIsRestoring(true);

            // Load backup based on provider
            let backupData: string;
            let metadata: any;

            if (manualProvider === 'local') {
                const result = await localProvider.loadBackup();
                backupData = result.data;
                metadata = result.metadata;
            } else {
                throw new Error('Cloud provider restore not yet implemented in this UI');
            }

            // Validate backup
            const isValid = await validateBackup(backupData);
            if (!isValid) {
                throw new Error('Invalid backup file');
            }

            // Restore
            await restoreBackup(backupData, metadata, {
                encryptionKey: metadata.encrypted ? settings.backupEncryptionKey : undefined,
                merge: false,
            });

            toast({
                title: 'Backup restored',
                description: 'Database has been restored from backup',
            });

            // Reload page to reflect changes
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            logger.error('[BackupSettings] Restore failed:', error);
            toast({
                title: 'Restore failed',
                description: error instanceof Error ? error.message : 'Failed to restore backup',
                variant: 'destructive',
            });
        } finally {
            setIsRestoring(false);
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
                            <div>
                                <label className="block text-sm font-medium mb-1">Client ID</label>
                                <input
                                    type="text"
                                    value={settings.googleDriveConfig?.clientId || ''}
                                    onChange={(e) => db.settings.update('default', {
                                        googleDriveConfig: {
                                            ...(settings.googleDriveConfig || { connected: false }),
                                            clientId: e.target.value,
                                        },
                                    })}
                                    placeholder="Your Google OAuth Client ID"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                            </div>
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
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Manual Backup</h2>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-2">Provider</label>
                        <div className="space-y-2">
                            {(['local', 'googledrive', 'dropbox'] as BackupProvider[]).map(provider => (
                                <div key={provider} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id={`manual-${provider}`}
                                        name="manual-provider"
                                        checked={manualProvider === provider}
                                        onChange={() => setManualProvider(provider)}
                                        className="h-4 w-4"
                                    />
                                    <label htmlFor={`manual-${provider}`} className="text-sm capitalize">
                                        {provider === 'googledrive' ? 'Google Drive' : provider}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="manual-include-logs"
                            checked={manualIncludeLogs}
                            onChange={(e) => setManualIncludeLogs(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="manual-include-logs" className="text-sm">
                            Include logs in backup
                        </label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="manual-encrypt"
                            checked={manualEncrypt}
                            onChange={(e) => setManualEncrypt(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="manual-encrypt" className="text-sm">
                            Encrypt backup
                        </label>
                    </div>

                    {manualEncrypt && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Encryption Key</label>
                            <div className="flex space-x-2">
                                <input
                                    type={showManualEncryptionKey ? 'text' : 'password'}
                                    value={manualEncryptionKey}
                                    onChange={(e) => setManualEncryptionKey(e.target.value)}
                                    placeholder="Enter encryption key"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => setShowManualEncryptionKey(!showManualEncryptionKey)}
                                >
                                    {showManualEncryptionKey ? '🙈' : '👁️'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Keep this key safe! You'll need it to restore this backup.
                            </p>
                        </div>
                    )}

                    <Button onClick={handleManualBackup} disabled={isBackingUp}>
                        {isBackingUp ? 'Creating Backup...' : 'Create Backup Now'}
                    </Button>
                </div>
            </section>

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
            {backupHistory && backupHistory.length > 0 && (
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
            )}
        </div>
    );
}

export default BackupSettings;
