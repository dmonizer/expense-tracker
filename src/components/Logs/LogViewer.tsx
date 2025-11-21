import {useEffect, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '@/services/db.ts';
import type {LogDefinition} from '@/types';
import LoadingSpinner from '../ui/LoadingSpinner';
import {logger} from '@/utils';
import {useConfirm} from "@/components/ui/confirm-provider";
import {useToast} from "@/hooks/use-toast";

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'ALL';

function LogViewer() {
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogDefinition | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 50;

  // Live query for logs
  const allLogs = useLiveQuery(async () => {
      return db.log.orderBy('timestamp').reverse().toArray();
  }, []);

  // Filter logs based on selected level and search query
  const filteredLogs = allLogs?.filter(log => {
    // Filter by level
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query) ||
        log.context?.toLowerCase().includes(query) ||
        log.error?.toLowerCase().includes(query)
      );
    }

    return true;
  }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevel, searchQuery]);

  const { confirm } = useConfirm();
  const { toast } = useToast();

  // ...

  const handleClearLogs = async () => {
    if (await confirm({
      title: 'Clear Logs',
      description: 'Are you sure you want to clear all logs? This cannot be undone.',
      confirmText: 'Clear All',
      variant: 'destructive'
    })) {
      try {
        await db.log.clear();
        setSelectedLog(null);
        logger.info('Logs cleared by user');
        toast({ title: "Success", description: "Logs cleared successfully" });
      } catch (error) {
        logger.error('Failed to clear logs', error);
        toast({ title: "Error", description: "Failed to clear logs", variant: "destructive" });
      }
    }
  };

  const handleExportLogs = () => {
    try {
      const logsJson = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([logsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs - ${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logger.info('Logs exported by user', { data: { count: filteredLogs.length } });
      toast({ title: "Success", description: "Logs exported successfully" });
    } catch (error) {
      logger.error('Failed to export logs', error);
      toast({ title: "Error", description: "Failed to export logs", variant: "destructive" });
    }
  };

  const getLevelColor = (level: LogDefinition['level']) => {
    switch (level) {
      case 'TRACE':
        return 'bg-gray-100 text-gray-700';
      case 'DEBUG':
        return 'bg-blue-100 text-blue-700';
      case 'INFO':
        return 'bg-green-100 text-green-700';
      case 'WARN':
        return 'bg-yellow-100 text-yellow-700';
      case 'ERROR':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getLevelIcon = (level: LogDefinition['level']) => {
    switch (level) {
      case 'TRACE':
        return '🔍';
      case 'DEBUG':
        return '🐛';
      case 'INFO':
        return 'ℹ️';
      case 'WARN':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return '📝';
    }
  };

  if (!allLogs) {
    return <LoadingSpinner text="Loading logs..." />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Application Logs
            </h2>
            <p className="text-gray-600">
              View and manage application logs
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportLogs}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              💾 Export Logs
            </button>
            <button
              onClick={handleClearLogs}
              disabled={allLogs.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
          {(['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as LogLevel[]).map(level => {
            const count = level === 'ALL'
              ? allLogs.length
              : allLogs.filter(l => l.level === level).length;

            return (
              <div
                key={level}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedLevel === level
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  } `}
                onClick={() => setSelectedLevel(level)}
              >
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {level}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {count}
                </div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Log List */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600 mb-2">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
          </div>

          {paginatedLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-gray-600">No logs found</p>
              {(selectedLevel !== 'ALL' || searchQuery) && (
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {paginatedLogs.map(log => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedLog?.id === log.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      } `}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{getLevelIcon(log.level)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getLevelColor(log.level)} `}>
                            {log.level}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium truncate">
                          {log.message}
                        </div>
                        {log.source && (
                          <div className="text-xs text-gray-500 truncate">
                            Source: {log.source}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Log Details */}
        <div className="lg:sticky lg:top-6">
          {selectedLog ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✖
                </button>
              </div>

              <div className="space-y-4">
                {/* Level */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Level</div>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${getLevelColor(selectedLog.level)} `}>
                    {getLevelIcon(selectedLog.level)} {selectedLog.level}
                  </span>
                </div>

                {/* Timestamp */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Timestamp</div>
                  <div className="text-sm text-gray-900">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Message</div>
                  <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {selectedLog.message}
                  </div>
                </div>

                {/* Source */}
                {selectedLog.source && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Source</div>
                    <div className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                      {selectedLog.source}
                    </div>
                  </div>
                )}

                {/* Context */}
                {selectedLog.context && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Context</div>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {selectedLog.context}
                    </div>
                  </div>
                )}

                {/* Data */}
                {selectedLog.data && selectedLog.data !== '{}' && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Data</div>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedLog.data), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {selectedLog.error && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Error</div>
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {selectedLog.error}
                    </div>
                  </div>
                )}

                {/* Stack Trace */}
                {selectedLog.stack && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Stack Trace</div>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto">
                      {selectedLog.stack}
                    </pre>
                  </div>
                )}

                {/* Meta */}
                {selectedLog.meta && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Metadata</div>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedLog.meta), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">👈</div>
              <p className="text-gray-600">Select a log to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LogViewer;
