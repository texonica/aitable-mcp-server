import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';

// Zod schemas for API responses
export const BaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissionLevel: z.string(),
});

export const ListBasesResponseSchema = z.object({
  bases: z.array(BaseSchema),
  offset: z.string().optional(),
});

export const FieldOptionsSchema = z.object({
  isReversed: z.boolean().optional(),
  inverseLinkFieldId: z.string().optional(),
  linkedTableId: z.string().optional(),
  prefersSingleRecordLink: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
}).passthrough();

export const FieldSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  options: FieldOptionsSchema.optional(),
}).passthrough();

export const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  primaryFieldId: z.string(),
  fields: z.array(FieldSchema),
  views: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    }),
  ),
});

export const BaseSchemaResponseSchema = z.object({
  tables: z.array(TableSchema),
  bases: z.array(BaseSchema).optional(),
});

// Tool argument schemas
export const ListRecordsArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table to query'),
  maxRecords: z.number().optional().describe('Maximum number of records to return. Defaults to 100.'),
  filterByFormula: z.string().optional().describe('Formula to filter records'),
});

export const SearchRecordsArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table to query'),
  searchTerm: z.string().describe('Text to search for in records'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to search in. If not provided, searches all text-based fields.'),
  maxRecords: z.number().optional().describe('Maximum number of records to return. Defaults to 100.'),
});

export const ListTablesArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  detailLevel: z.enum(['tableIdentifiersOnly', 'identifiersOnly', 'full']).optional().describe('The amount of detail to get about the tables'),
});

export const ListAllDatasheetsArgsSchema = z.object({
  spaceId: z.string().describe('ID of the AITable space to search for datasheets'),
});

export const GetDatasheetRecordsByNameArgsSchema = z.object({
  spaceId: z.string().describe('ID of the AITable space containing the datasheet'),
  datasheetName: z.string().describe('Name of the datasheet to get records from'),
  maxRecords: z.number().optional().describe('Maximum number of records to return (optional)'),
  filterByFormula: z.string().optional().describe('Filter formula to apply (optional)'),
});

export const DescribeTableArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table to describe'),
  detailLevel: z.enum(['tableIdentifiersOnly', 'identifiersOnly', 'full']).optional().describe('The amount of detail to get about the table'),
});

export const GetRecordArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  recordId: z.string().describe('ID of the record to retrieve'),
});

export const CreateRecordArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  fields: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    ])
  ).describe('Fields and values for the new record. Values should be primitives (string, number, boolean, null) or arrays of primitives.'),
});

export const UpdateRecordsArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  records: z.array(
    z.object({
      id: z.string().describe('ID of the record to update'),
      fields: z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        ])
      ).describe('Fields and values to update. Values should be primitives (string, number, boolean, null) or arrays of primitives.'),
    }),
  ).describe('Records to update'),
});

export const DeleteRecordsArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  recordIds: z.array(z.string()).describe('IDs of records to delete'),
});

export const CreateTableArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  name: z.string().describe('Name of the new table'),
  description: z.string().optional().describe('Description of the table'),
  fields: z.array(FieldSchema).describe('Field definitions for the table'),
});

export const UpdateTableArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  name: z.string().optional().describe('New name for the table'),
  description: z.string().optional().describe('New description for the table'),
});

export const CreateFieldArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  name: z.string().describe('Name of the new field'),
  type: z.string().describe('Type of the field'),
  description: z.string().optional().describe('Description of the field'),
  options: FieldOptionsSchema.optional().describe('Field-specific options'),
});

export const UpdateFieldArgsSchema = z.object({
  baseId: z.string().describe('ID of the AITable base'),
  tableId: z.string().describe('ID of the table'),
  fieldId: z.string().describe('ID of the field'),
  name: z.string().optional().describe('New name for the field'),
  description: z.string().optional().describe('New description for the field'),
});

// Type definitions
export type ListBasesResponse = z.infer<typeof ListBasesResponseSchema>;
export type BaseSchemaResponse = z.infer<typeof BaseSchemaResponseSchema>;
export type Base = z.infer<typeof BaseSchema>;
export type Table = z.infer<typeof TableSchema>;
export type Field = z.infer<typeof FieldSchema>;

export type FieldSet = Record<string, any>;
export type AITableRecord = { id: string; fields: FieldSet };

/**
 * Extended information about a datasheet, including its location in the folder hierarchy
 */
export interface DatasheetInfo {
  /** Unique ID of the datasheet */
  id: string;
  /** Name of the datasheet */
  name: string;
  /** Path to the datasheet including folder hierarchy (e.g. "Folder > Subfolder > Datasheet") */
  path: string;
  /** ID of the space containing this datasheet */
  spaceId: string;
}

export interface ListRecordsOptions {
  maxRecords?: number;
  filterByFormula?: string;
}

// Service interfaces
export interface IAITableService {
  listBases(): Promise<ListBasesResponse>;
  getBaseSchema(baseId: string): Promise<BaseSchemaResponse>;
  getAllDatasheets(spaceId: string): Promise<DatasheetInfo[]>;
  getDatasheetRecordsByName(spaceId: string, datasheetName: string, options?: ListRecordsOptions): Promise<AITableRecord[]>;
  listRecords(baseId: string, tableId: string, options?: ListRecordsOptions): Promise<AITableRecord[]>;
  getRecord(baseId: string, tableId: string, recordId: string): Promise<AITableRecord>;
  createRecord(baseId: string, tableId: string, fields: FieldSet): Promise<AITableRecord>;
  updateRecords(baseId: string, tableId: string, records: { id: string; fields: FieldSet }[]): Promise<AITableRecord[]>;
  deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]>;
  createTable(baseId: string, name: string, fields: Field[], description?: string): Promise<Table>;
  updateTable(baseId: string, tableId: string, updates: { name?: string; description?: string }): Promise<Table>;
  createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field>;
  updateField(baseId: string, tableId: string, fieldId: string, updates: { name?: string; description?: string }): Promise<Field>;
  searchRecords(baseId: string, tableId: string, searchTerm: string, fieldIds?: string[], maxRecords?: number): Promise<AITableRecord[]>;
}

export interface IAITableMCPServer {
  connect(transport: Transport): Promise<void>;
  close(): Promise<void>;
}
