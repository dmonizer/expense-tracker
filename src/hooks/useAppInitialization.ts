import {useEffect, useState} from 'react';
import {initializeDefaults} from '../services/seedData';
import {initializeBuiltInFormats} from '../services/formatLoader';
import {migrateAllPatterns} from '../utils/patternMigration';
import {logger} from '@/utils';

interface InitializationState {
    isInitialized: boolean;
    error: string | null;
}

/**
 * Custom hook to handle application initialization
 * Initializes defaults, built-in formats, and runs pattern migration
 */
export function useAppInitialization(): InitializationState {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                // Initialize default categories/groups
                const result = await initializeDefaults();
                if (!result.success) {
                    logger.warn('Failed to initialize defaults:', result.message);
                    setError(result.message);
                }

                // Initialize built-in import formats
                await initializeBuiltInFormats();

                // Run pattern migration to update legacy patterns to new multi-field format
                const migrationResult = await migrateAllPatterns();
                logger.info(`Pattern migration: ${migrationResult.migrated}/${migrationResult.total} patterns migrated`);
                if (migrationResult.errors.length > 0) {
                    logger.warn('Pattern migration had errors:', migrationResult.errors);
                }
            } catch (error) {
                logger.error('Error during initialization:', error);
                setError(error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setIsInitialized(true);
            }
        };

        initialize();
    }, []);

    return { isInitialized, error };
}
