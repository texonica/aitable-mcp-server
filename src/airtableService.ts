import nodeFetch, { RequestInit } from 'node-fetch';
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
} from './types.js';
import { z } from 'zod';

export class AirtableService implements IAirtableService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof nodeFetch;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.airtable.com',
    fetch: typeof nodeFetch = nodeFetch
) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetch;
  }

  private async fetchFromAPI<T>(endpoint: string, schema: z.ZodSchema<T>, options: RequestInit = {}): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
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

  async listRecords(baseId: string, tableId: string, options?: ListRecordsOptions): Promise<AirtableRecord[]> {
    const queryParams = options?.maxRecords ? `?maxRecords=${options.maxRecords}` : '';
    const response = await this.fetchFromAPI(
      `/v0/${baseId}/${tableId}${queryParams}`,
      z.object({ records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })) })
    );
    return response.records;
  }

  async getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord> {
    return this.fetchFromAPI(
      `/v0/${baseId}/${tableId}/${recordId}`,
      z.object({ id: z.string(), fields: z.record(z.any()) })
    );
  }

  async createRecord(baseId: string, tableId: string, fields: Record<string, any>): Promise<AirtableRecord> {
    return this.fetchFromAPI(
      `/v0/${baseId}/${tableId}`,
      z.object({ id: z.string(), fields: z.record(z.any()) }),
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      }
    );
  }

  async updateRecords(
    baseId: string, 
    tableId: string, 
    records: { id: string; fields: Record<string, any> }[]
  ): Promise<AirtableRecord[]> {
    const response = await this.fetchFromAPI(
      `/v0/${baseId}/${tableId}`,
      z.object({ records: z.array(z.object({ id: z.string(), fields: z.record(z.any()) })) }),
      {
        method: 'PATCH',
        body: JSON.stringify({ records }),
      }
    );
    return response.records;
  }

  async deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]> {
    const queryString = recordIds.map(id => `records[]=${id}`).join('&');
    const response = await this.fetchFromAPI(
      `/v0/${baseId}/${tableId}?${queryString}`,
      z.object({ records: z.array(z.object({ id: z.string(), deleted: z.boolean() })) }),
      {
        method: 'DELETE'
      }
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
      }
    );
  }

  async updateTable(
    baseId: string,
    tableId: string,
    updates: { name?: string; description?: string }
  ): Promise<Table> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}`,
      TableSchema,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  }

  async createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
      FieldSchema,
      {
        method: 'POST',
        body: JSON.stringify(field),
      }
    );
  }

  async updateField(
    baseId: string,
    tableId: string,
    fieldId: string,
    updates: { name?: string; description?: string }
  ): Promise<Field> {
    return this.fetchFromAPI(
      `/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
      FieldSchema,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  }
}
