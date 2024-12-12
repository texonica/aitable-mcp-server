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
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  options: FieldOptionsSchema.optional(),
});

export const ViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

export const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  primaryFieldId: z.string(),
  fields: z.array(FieldSchema),
  views: z.array(ViewSchema),
});

export const BaseSchemaResponseSchema = z.object({
  tables: z.array(TableSchema),
});

// Zod schemas for tool arguments
export const ListRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  maxRecords: z.number().optional(),
});

export const ListTablesArgsSchema = z.object({
  baseId: z.string(),
});

export const GetRecordArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  recordId: z.string(),
});

export const CreateRecordArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  fields: z.record(z.any()),
});

export const UpdateRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  records: z.array(z.object({
    id: z.string(),
    fields: z.record(z.any()),
  })),
});

export const DeleteRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  recordIds: z.array(z.string()),
});

export const CreateTableArgsSchema = z.object({
  baseId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    options: FieldOptionsSchema.optional(),
  })),
});

export const UpdateTableArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const CreateFieldArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  options: FieldOptionsSchema.optional(),
});

export const UpdateFieldArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  fieldId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export type ListBasesResponse = z.infer<typeof ListBasesResponseSchema>;
export type BaseSchemaResponse = z.infer<typeof BaseSchemaResponseSchema>;
export type Table = z.infer<typeof TableSchema>;
export type Field = z.infer<typeof FieldSchema>;
export type AirtableRecord = { id: string, fields: Record<string, any> };

export interface ListRecordsOptions {
  maxRecords?: number | undefined;
}

export interface IAirtableService {
  listBases(): Promise<ListBasesResponse>;
  getBaseSchema(baseId: string): Promise<BaseSchemaResponse>;
  listRecords(baseId: string, tableId: string, options?: ListRecordsOptions): Promise<AirtableRecord[]>;
  getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord>;
  createRecord(baseId: string, tableId: string, fields: Record<string, any>): Promise<AirtableRecord>;
  updateRecords(baseId: string, tableId: string, records: { id: string; fields: Record<string, any> }[]): Promise<AirtableRecord[]>;
  deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]>;
  createTable(baseId: string, name: string, fields: Omit<Field, 'id'>[], description?: string): Promise<Table>;
  updateTable(baseId: string, tableId: string, updates: { name?: string | undefined; description?: string | undefined }): Promise<Table>;
  createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field>;
  updateField(baseId: string, tableId: string, fieldId: string, updates: { name?: string | undefined; description?: string | undefined }): Promise<Field>;
}

export interface IAirtableMCPServer {
  connect(transport: any): Promise<void>;
}
