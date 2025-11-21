import {v4 as uuidv4} from 'uuid';
import {db} from './db';
import type {ImportFormatDefinition} from '@/types';

/**
 * Format Manager Service
 * Handles CRUD operations for import format definitions
 */

/*
 * Get all import format definitions
 */
export async function getAllFormats(): Promise<ImportFormatDefinition[]> {
  return await db.importFormats.toArray();
}

/**
 * Get format by ID
 */
export async function getFormatById(id: string): Promise<ImportFormatDefinition | undefined> {
  return await db.importFormats.get(id);
}

/**
 * Get the default format (if any)
 */
export async function getDefaultFormat(): Promise<ImportFormatDefinition | undefined> {
  return await db.importFormats.where('isDefault').equals(1).first();
}

/**
 * Save a new format
 */
export async function saveFormat(format: Omit<ImportFormatDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const newFormat: ImportFormatDefinition = {
    ...format,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  // If this format is set as default, unset all other defaults
  if (newFormat.isDefault) {
    await unsetAllDefaults();
  }

  await db.importFormats.add(newFormat);
  return newFormat.id;
}

/**
 * Update an existing format
 */
export async function updateFormat(format: ImportFormatDefinition): Promise<void> {
  // Don't allow editing built-in formats
  const existing = await db.importFormats.get(format.id);
  if (existing?.isBuiltIn) {
    throw new Error('Cannot edit built-in formats');
  }

  // If this format is set as default, unset all other defaults
  if (format.isDefault) {
    await unsetAllDefaults(format.id);
  }

  await db.importFormats.update(format.id, {
    ...format,
    updatedAt: new Date(),
  });
}

/**
 * Delete a format
 */
export async function deleteFormat(id: string): Promise<void> {
  const format = await db.importFormats.get(id);
  
  // Don't allow deleting built-in formats
  if (format?.isBuiltIn) {
    throw new Error('Cannot delete built-in formats');
  }

  await db.importFormats.delete(id);
}

/**
 * Duplicate a format with a new name
 */
export async function duplicateFormat(id: string, newName: string): Promise<ImportFormatDefinition> {
  const original = await db.importFormats.get(id);
  if (!original) {
    throw new Error('Format not found');
  }

  const now = new Date();
  const duplicate: ImportFormatDefinition = {
    ...original,
    id: uuidv4(),
    name: newName,
    isDefault: false, // Duplicates are never default
    isBuiltIn: false, // Duplicates are never built-in
    createdAt: now,
    updatedAt: now,
  };

  await db.importFormats.add(duplicate);
  return duplicate;
}

/**
 * Set a format as default
 */
export async function setDefaultFormat(id: string): Promise<void> {
  await unsetAllDefaults(id);
  await db.importFormats.update(id, { isDefault: true });
}

/**
 * Unset all default formats (except optionally one)
 */
async function unsetAllDefaults(exceptId?: string): Promise<void> {
  const defaultFormats = await db.importFormats.where('isDefault').equals(1).toArray();
  
  for (const format of defaultFormats) {
    if (format.id !== exceptId) {
      await db.importFormats.update(format.id, { isDefault: false });
    }
  }
}

/**
 * Rename a format
 */
export async function renameFormat(id: string, newName: string): Promise<void> {
  const format = await db.importFormats.get(id);
  
  // Don't allow renaming built-in formats
  if (format?.isBuiltIn) {
    throw new Error('Cannot rename built-in formats');
  }

  await db.importFormats.update(id, {
    name: newName,
    updatedAt: new Date(),
  });
}

/**
 * Export format as JSON
 */
export function exportFormatAsJSON(format: ImportFormatDefinition): string {
  // Remove id, createdAt, updatedAt for portability
  const exportData = {
    name: format.name,
    description: format.description,
    fileType: format.fileType,
    csvSettings: format.csvSettings,
    fieldMappings: format.fieldMappings,
    detectionPattern: format.detectionPattern,
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import format from JSON
 */
export async function importFormatFromJSON(jsonString: string): Promise<string> {
  const data = JSON.parse(jsonString);
  
  // Validate required fields
  if (!data.name || !data.fileType || !data.fieldMappings) {
    throw new Error('Invalid format data');
  }

  // Create new format from imported data
    return await saveFormat({
      name: data.name,
      description: data.description,
      fileType: data.fileType,
      csvSettings: data.csvSettings,
      fieldMappings: data.fieldMappings,
      detectionPattern: data.detectionPattern,
      isBuiltIn: false,
      isDefault: false,
  });
}
