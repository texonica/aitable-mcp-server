import nodeFetch, { RequestInit } from 'node-fetch';
import { z } from 'zod';
import type {
  IAirtableService,
  ListBasesResponse,
  BaseSchemaResponse,
  ListRecordsOptions,
  Field,
  Table,
  AirtableRecord,
  FieldSet
} from './types.js';
import {
  ListBasesResponseSchema,
  BaseSchemaResponseSchema
} from './types.js';

/**
 * Service for interacting with the AITable API
 */
export class AITableService implements IAirtableService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof nodeFetch;

  constructor(
    apiKey: string = process.env.AITABLE_API_KEY || '',
    baseUrl: string = 'https://api.aitable.ai',
    fetch: typeof nodeFetch = nodeFetch,
  ) {
    console.log('API Key from env:', process.env.AITABLE_API_KEY);
    console.log('API Key from param:', apiKey);
    
    if (!apiKey) {
      throw new Error('aitable-mcp-server: No API key provided. Set it in the `AITABLE_API_KEY` environment variable');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetch;
  }

  /**
   * Helper method to make API requests and validate responses
   */
  private async fetchFromAPI<T>(endpoint: string, schema: z.ZodSchema<T>, options: RequestInit = {}): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const responseText = await response.text();
    let responseJson;

    try {
      responseJson = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`aitable-mcp-server: Failed to parse JSON response: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(`aitable-mcp-server: API request failed: ${JSON.stringify(responseJson)}`);
    }

    try {
      return schema.parse(responseJson);
    } catch (error) {
      throw new Error(`aitable-mcp-server: API response validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all available AITable bases
   */
  async listBases(): Promise<ListBasesResponse> {
    return this.fetchFromAPI('/v0/meta/bases', ListBasesResponseSchema);
  }

  /**
   * Get schema information for a base
   */
  async getBaseSchema(baseId: string): Promise<BaseSchemaResponse> {
    return this.fetchFromAPI(`/v0/meta/bases/${baseId}/tables`, BaseSchemaResponseSchema);
  }

  /**
   * List records from a table
   */
  async listRecords(baseId: string, tableId: string, options: ListRecordsOptions = {}): Promise<AirtableRecord[]> {
    const queryParams = new URLSearchParams();
    
    if (options.maxRecords) {
      queryParams.append('maxRecords', options.maxRecords.toString());
    }
    
    if (options.filterByFormula) {
      queryParams.append('filterByFormula', options.filterByFormula);
    }
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/records${queryString}`,
      z.object({ records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })) })
    );
    
    return response.records;
  }

  /**
   * Get a specific record
   */
  async getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord> {
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/records/${recordId}`,
      z.object({ id: z.string(), fields: z.record(z.any()) })
    );
    
    return response;
  }

  /**
   * Create a new record
   */
  async createRecord(baseId: string, tableId: string, fields: FieldSet): Promise<AirtableRecord> {
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/records`,
      z.object({ id: z.string(), fields: z.record(z.any()) }),
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      }
    );
    
    return response;
  }

  /**
   * Update multiple records
   */
  async updateRecords(
    baseId: string,
    tableId: string,
    records: { id: string; fields: FieldSet }[],
  ): Promise<AirtableRecord[]> {
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/records`,
      z.object({ records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })) }),
      {
        method: 'PATCH',
        body: JSON.stringify({ records }),
      }
    );
    
    return response.records;
  }

  /**
   * Delete records
   */
  async deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]> {
    const queryParams = new URLSearchParams();
    recordIds.forEach(id => queryParams.append('recordIds', id));
    
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/records?${queryParams.toString()}`,
      z.object({ records: z.array(z.object({ id: z.string() })) }),
      {
        method: 'DELETE',
      }
    );
    
    return response.records;
  }

  /**
   * Create a new table
   */
  async createTable(baseId: string, name: string, fields: Field[], description?: string): Promise<Table> {
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables`,
      z.object({ id: z.string() }).and(z.record(z.any())),
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          fields,
        }),
      }
    );

    // After creating the table, fetch its complete schema
    const tableSchema = await this.getBaseSchema(baseId);
    const createdTable = tableSchema.tables.find(table => table.id === response.id);
    
    if (!createdTable) {
      throw new Error(`aitable-mcp-server: Created table not found in schema`);
    }
    
    return createdTable;
  }

  /**
   * Update a table's name or description
   */
  async updateTable(
    baseId: string,
    tableId: string,
    updates: { name?: string; description?: string },
  ): Promise<Table> {
    await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}`,
      z.object({}),
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );

    // After updating, fetch the table schema to get the latest
    const tableSchema = await this.getBaseSchema(baseId);
    const updatedTable = tableSchema.tables.find(table => table.id === tableId);
    
    if (!updatedTable) {
      throw new Error(`aitable-mcp-server: Updated table not found in schema`);
    }
    
    return updatedTable;
  }

  /**
   * Create a new field in a table
   */
  async createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field> {
    const response = await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/fields`,
      z.object({ id: z.string() }).and(z.record(z.any())),
      {
        method: 'POST',
        body: JSON.stringify(field),
      }
    );

    // After creating the field, fetch its complete schema
    const tableSchema = await this.getBaseSchema(baseId);
    const table = tableSchema.tables.find(t => t.id === tableId);
    
    if (!table) {
      throw new Error(`aitable-mcp-server: Table not found after creating field`);
    }
    
    const createdField = table.fields.find(f => f.id === response.id);
    
    if (!createdField) {
      throw new Error(`aitable-mcp-server: Created field not found in schema`);
    }
    
    return createdField;
  }

  /**
   * Update a field's name or description
   */
  async updateField(
    baseId: string,
    tableId: string,
    fieldId: string,
    updates: { name?: string; description?: string },
  ): Promise<Field> {
    await this.fetchFromAPI(
      `/v0/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
      z.object({}),
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );

    // After updating, fetch the field schema to get the latest
    const tableSchema = await this.getBaseSchema(baseId);
    const table = tableSchema.tables.find(t => t.id === tableId);
    
    if (!table) {
      throw new Error(`aitable-mcp-server: Table not found after updating field`);
    }
    
    const updatedField = table.fields.find(f => f.id === fieldId);
    
    if (!updatedField) {
      throw new Error(`aitable-mcp-server: Updated field not found in schema`);
    }
    
    return updatedField;
  }

  /**
   * Helper to validate and get fields for searching
   */
  private async validateAndGetSearchFields(
    baseId: string,
    tableId: string,
    requestedFieldIds?: string[],
  ): Promise<string[]> {
    // Get the table schema
    const baseSchema = await this.getBaseSchema(baseId);
    const table = baseSchema.tables.find(t => t.id === tableId);
    
    if (!table) {
      throw new Error(`aitable-mcp-server: Table not found`);
    }

    // If field IDs were specified, validate they exist and use them
    if (requestedFieldIds && requestedFieldIds.length > 0) {
      const validFieldIds = table.fields
        .filter(field => requestedFieldIds.includes(field.id || ''))
        .map(field => field.id || '');
      
      if (validFieldIds.length === 0) {
        throw new Error(`aitable-mcp-server: None of the requested field IDs exist in the table`);
      }
      
      return validFieldIds;
    }

    // Otherwise, use text-based fields
    const textFieldTypes = [
      'singleLineText', 
      'multilineText', 
      'richText', 
      'email', 
      'url', 
      'phone'
    ];
    
    const textFieldIds = table.fields
      .filter(field => textFieldTypes.includes(field.type))
      .map(field => field.id || '');
    
    if (textFieldIds.length === 0) {
      throw new Error(`aitable-mcp-server: No text fields found in the table`);
    }
    
    return textFieldIds;
  }

  /**
   * Search for records containing a search term
   */
  async searchRecords(
    baseId: string,
    tableId: string,
    searchTerm: string,
    fieldIds?: string[],
    maxRecords: number = 100,
  ): Promise<AirtableRecord[]> {
    // Find appropriate fields to search in
    const searchFieldIds = await this.validateAndGetSearchFields(baseId, tableId, fieldIds);
    
    // Construct search formula using OR conditions
    const searchConditions = searchFieldIds.map(fieldId => 
      `FIND("${searchTerm.replace(/"/g, '\\"')}", {${fieldId}})`
    );
    
    const filterByFormula = `OR(${searchConditions.join(',')})`;
    
    // Search using listRecords with a filter formula
    return this.listRecords(baseId, tableId, {
      filterByFormula,
      maxRecords,
    });
  }
} 