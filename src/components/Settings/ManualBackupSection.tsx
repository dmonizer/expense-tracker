import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createBackup } from '../../services/databaseBackup';
import * as localProvider from '../../services/backupProviders/localBackupProvider';
import * as googleDriveProvider from '../../services/backupProviders/googleDriveProvider';
import * as dropboxProvider from '../../services/backupProviders/dropboxProvider';
import { logger } from '../../utils';
import { db } from '../../services/db';
import type { BackupProvider } from '../../types/backupTypes';
import type { UserSettings } from '../../types';

interface ManualBackupSectionProps {
    settings: UserSettings;
}

export function ManualBackupSection({ settings }: ManualBackupSectionProps) {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [manualProvider, setManualProvider] = useState<BackupProvider>('local');
    const [manualEncrypt, setManualEncrypt] = useState(false);
    const [manualEncryptionKey, setManualEncryptionKey] = useState('');
    const [manualIncludeLogs, setManualIncludeLogs] = useState(false);
    const [showManualEncryptionKey, setShowManualEncryptionKey] = useState(false);

    const { toast } = useToast();

    const handleManualBackup = async () => {
        try {
            setIsBackingUp(true);

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

    return (
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
    );
}
