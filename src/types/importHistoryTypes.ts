// Import History Types
export interface ImportRecord {
    id: string;
    fileName: string;
    importDate: Date;
    transactionCount: number;
    newCount: number;
    duplicateCount: number;
}