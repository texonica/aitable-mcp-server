import nodeFetch, { RequestInit } from 'node-fetch';
import { z } from 'zod';
import {
  IAirtableService,
  ListBasesResponse,
  BaseSchemaResponse,
  ListRecordsOptions,
  Field,
  Table,
  AirtableRecord,
  ListBasesResponseSchema,
  BaseSchemaResponseSchema,
  TableSchema,
  FieldSchema,
  FieldSet,
} from './types.js';

export class AirtableService implements IAirtableService {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly fetch: typeof nodeFetch;

  constructor(
    apiKey: string = process.env.AIRTABLE_API_KEY || '',
    baseUrl: string = 'https://api.airtable.com',
    fetch: typeof nodeFetch = nodeFetch,
  ) {
    if (!apiKey) {
      throw new Error('airtable-mcp-server: No API key provided. Set it in the `AIRTABLE_API_KEY` environment variable');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetch;
  }

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

    if (!response.ok) {
      throw new Error(`Airtable API Error: ${response.statusText}. Response: ${responseText}`);
    }

    try {
      const data = JSON.parse(responseText);
      return schema.parse(data);
    } catch (parseError) {
      throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  }

  async listBases(): Promise<ListBasesResponse> {
    return this.fetchFromAPI('/v0/meta/bases', ListBasesResponseSchema);
  }

  async getBaseSchema(baseId: string): Promise<BaseSchemaResponse> {
    return this.fetchFromAPI(`/v0/meta/bases/${baseId}/tables`, BaseSchemaResponseSchema);
  }

  async listRecords(baseId: string, tableId: string, options: ListRecordsOptions = {}): Promise<AirtableRecord[]> {
    let allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const queryParams = new URLSearchParams();
      if (options.maxRecords) queryParams.append('maxRecords', options.maxRecords.toString());
      if (options.filterByFormula) queryParams.append('filterByFormula', options.filterByFormula);
      if (offset) queryParams.append('offset', offset);

      // eslint-disable-next-line no-await-in-loop
      const response = await this.fetchFromAPI(
        `/v0/${baseId}/${tableId}?${queryParams.toString()}`,
        z.object({
          records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })),
          offset: z.string().optional(),
        }),
      );

      allRecords = allRecords.concat(response.records);
      offset = response.offset;
    } while (offset);

    return allRecords;
  }

  async getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord> {
    return this.fetchFromAPI(
      `/v0/${baseId}/${tableId}/${recordId}`,
      z.object({ id: z.string(), fields: z.record(z.any()) }),
    );
  }

  async createRecord(baseId: string, tableId: string, fields: FieldSet): Promise<AirtableRecord> {
    return this.fetchFromAPI(
      `/v0/${baseId}/${tableId}`,
      z.object({ id: z.string(), fields: z.record(z.any()) }),
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      },
    );
  }

  async updateRecords(
    baseId: string,
    tableId: string,
    records: { id: string; fields: FieldSet }[],
  ): Promise<AirtableRecord[]> {
    const response = await this.fetchFromAPI(
      `/v0/${baseId}/${tableId}`,
      z.object({ records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })) }),
      {
        method: 'PATCH',
        body: JSON.stringify({ records }),
      },
    );
    return response.records;
  }

  async deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]> {
    const queryString = recordIds.map((id) => `records[]=${id}`).join('&');
    const response = await this.fetchFromAPI(
      `/v0/${baseId}/${tableId}?${queryString}`,
      z.object({ records: z.array(z.object({ id: z.string(), deleted: z.boolean() })) }),
      {
        method: 'DELETE',
      },
    );
    return response.records.map(({ id }) => ({ id }));
  }

  async createTable(baseId: string, name: string, fields: Field[], description?: string): Promise<Table> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables`,
      TableSchema,
      {
        method: 'POST',
        body: JSON.stringify({ name, description, fields }),
      },
    );
  }

  async updateTable(
    baseId: string,
    tableId: string,
    updates: { name?: string; description?: string },
  ): Promise<Table> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}`,
      TableSchema,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    );
  }

  async createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
      FieldSchema,
      {
        method: 'POST',
        body: JSON.stringify(field),
      },
    );
  }

  async updateField(
    baseId: string,
    tableId: string,
    fieldId: string,
    updates: { name?: string; description?: string },
  ): Promise<Field> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
      FieldSchema,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    );
  }

  /**
   * Get all searchable fields from a table
   * 
   * @param baseId Base ID
   * @param tableId Table ID
   * @returns Array of field IDs
   */
  async getSearchableFields(baseId: string, tableId: string): Promise<string[]> {
    const baseSchema = await this.getBaseSchema(baseId);
    const table = baseSchema.tables.find(t => t.id === tableId);
    
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }
    
    // Get all text, rich text, and URL fields as they are searchable
    const searchableFieldTypes = [
      'singleLineText',
      'multilineText',
      'richText',
      'singleSelect',
      'multipleSelects',
      'url',
      'email',
      'phone',
    ];
    
    // Create an array of string field IDs
    const searchableFields: string[] = [];
    for (const field of table.fields) {
      if (searchableFieldTypes.includes(field.type) && field.id) {
        searchableFields.push(field.id);
      }
    }
    
    return searchableFields;
  }

  /**
   * Search for records containing specific text
   * 
   * @param baseId Base ID
   * @param tableId Table ID
   * @param searchTerm Text to search for
   * @param fieldIds Optional specific fields to search in
   * @param maxRecords Maximum number of records to return
   * @returns Array of matched records
   */
  async searchRecords(
    baseId: string,
    tableId: string,
    searchTerm: string,
    fieldIds?: string[],
    maxRecords?: number,
  ): Promise<Record<string, any>[]> {
    // Get all searchable fields if not specified
    let fieldsToSearch: string[];
    if (fieldIds && fieldIds.length > 0) {
      const allSearchableFields = await this.getSearchableFields(baseId, tableId);
      // Validate that all requested fields are searchable
      const invalidFields = fieldIds.filter(id => !allSearchableFields.includes(id));
      if (invalidFields.length > 0) {
        throw new Error(`Invalid fields for searching: ${invalidFields.join(', ')}`);
      }
      fieldsToSearch = fieldIds;
    } else {
      fieldsToSearch = await this.getSearchableFields(baseId, tableId);
    }
    
    if (fieldsToSearch.length === 0) {
      throw new Error('No text fields available to search');
    }

    // Get all records first - we'll filter them in memory
    const records = await this.listRecords(baseId, tableId, { maxRecords });
    
    // Filter records that contain the search term in any of the specified fields
    const searchTermLower = searchTerm.toLowerCase();
    const matchedRecords = records.filter(record => {
      return fieldsToSearch.some(fieldId => {
        const value = record.fields[fieldId];
        if (value === undefined || value === null) return false;
        
        // Convert to string and check if it contains the search term
        const valueStr = String(value).toLowerCase();
        return valueStr.includes(searchTermLower);
      });
    });
    
    // Limit the results if maxRecords is specified
    return maxRecords ? matchedRecords.slice(0, maxRecords) : matchedRecords;
  }
}
